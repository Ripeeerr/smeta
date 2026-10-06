from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Department, User
from purchasing.models import Budget, Supplier


@pytest.fixture
def workspace(db):
    sales = Department.objects.create(name="Продажи")
    other = Department.objects.create(name="ИТ")
    employee = User.objects.create_user(
        username="employee", password="test-only-password", role="employee", department=sales
    )
    manager = User.objects.create_user(
        username="manager", password="test-only-password", role="manager", department=sales
    )
    buyer = User.objects.create_user(username="buyer", password="test-only-password", role="buyer")
    admin = User.objects.create_user(
        username="director", password="test-only-password", role="admin"
    )
    outsider = User.objects.create_user(
        username="outsider", password="test-only-password", role="employee", department=other
    )
    budget = Budget.objects.create(
        department=sales, month=timezone.localdate().replace(day=1), limit=Decimal("1000")
    )
    supplier = Supplier.objects.create(name="Поставщик", tax_id="7701234567")
    return {
        "sales": sales,
        "other": other,
        "employee": employee,
        "manager": manager,
        "buyer": buyer,
        "admin": admin,
        "outsider": outsider,
        "budget": budget,
        "supplier": supplier,
    }


@pytest.fixture
def client():
    return APIClient()
