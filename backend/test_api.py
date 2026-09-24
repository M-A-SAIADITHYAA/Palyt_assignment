from fastapi.testclient import TestClient
import pytest

from backend.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_stock():
    """Reset to initial stock before each test."""
    client.post("/api/reset")
    yield
    client.post("/api/reset")


def test_get_stock_and_menu():
    stock_res = client.get("/api/stock")
    assert stock_res.status_code == 200
    stock_data = stock_res.json()
    assert len(stock_data) == 15

    menu_res = client.get("/api/menu")
    assert menu_res.status_code == 200
    menu_data = menu_res.json()
    assert len(menu_data) == 6

    # Verify initial availability
    menu_map = {d["dish"]: d for d in menu_data}
    assert menu_map["Paneer Butter Masala"]["available"] is True
    assert menu_map["Chicken Biryani"]["available"] is False


def test_add_and_validate_ingredient():
    # 1. Valid add
    res = client.post("/api/stock", json={
        "name": "Cardamom",
        "qty": 50,
        "unit": "g",
        "par": 10
    })
    assert res.status_code == 201
    assert res.json()["item"]["name"] == "Cardamom"

    # 2. Reject duplicate
    dup_res = client.post("/api/stock", json={
        "name": "Cardamom",
        "qty": 10,
        "unit": "g",
        "par": 5
    })
    assert dup_res.status_code == 400

    # 3. Reject negative qty (nonsense validation)
    neg_res = client.post("/api/stock", json={
        "name": "Cinnamon",
        "qty": -5,
        "unit": "g",
        "par": 2
    })
    assert neg_res.status_code == 422

    # 4. Reject invalid unit (nonsense validation)
    unit_res = client.post("/api/stock", json={
        "name": "Cinnamon",
        "qty": 5,
        "unit": "pinch",
        "par": 2
    })
    assert unit_res.status_code == 422


def test_edit_stock_ingredient():
    res = client.put("/api/stock/Paneer", json={"qty": 2.5, "par": 0.8})
    assert res.status_code == 200
    updated = res.json()["item"]
    assert updated["qty"] == 2.5
    assert updated["par"] == 0.8


def test_delete_ingredient_identifies_affected_dishes():
    # Cashews is used by Paneer Butter Masala and Shahi Paneer Korma
    del_res = client.delete("/api/stock/Cashews")
    assert del_res.status_code == 200
    affected = del_res.json()["affected_dishes"]
    assert "Paneer Butter Masala" in affected
    assert "Shahi Paneer Korma" in affected

    # After deleting Cashews, both dishes must now be unavailable on menu
    menu_res = client.get("/api/menu")
    menu_map = {d["dish"]: d for d in menu_res.json()}
    assert menu_map["Paneer Butter Masala"]["available"] is False
    assert "Missing ingredient: 'Cashews'" in menu_map["Paneer Butter Masala"]["reason"]
    assert menu_map["Shahi Paneer Korma"]["available"] is False


def test_order_dish_and_reaction():
    # Ordering Paneer Butter Masala deducts 15g cashews (starts at 300g, par 250g)
    for _ in range(3):
        order_res = client.post("/api/order", json={"dish": "Paneer Butter Masala"})
        assert order_res.status_code == 200

    # 4th order drops cashews to 240g (< 250g par)
    order_4 = client.post("/api/order", json={"dish": "Paneer Butter Masala"})
    assert order_4.status_code == 200

    # Menu in response should show Paneer Butter Masala now unavailable
    menu_map = {d["dish"]: d for d in order_4.json()["menu"]}
    assert menu_map["Paneer Butter Masala"]["available"] is False
    assert "below par level" in menu_map["Paneer Butter Masala"]["reason"]

    # Trying to order it again should fail
    fail_res = client.post("/api/order", json={"dish": "Paneer Butter Masala"})
    assert fail_res.status_code == 400
