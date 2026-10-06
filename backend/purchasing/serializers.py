from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from accounts.models import Department, User

from .models import (
    Attachment,
    Budget,
    Event,
    Purchase,
    Quote,
    Requisition,
    RequisitionItem,
    Supplier,
)
from .services import save_requisition


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name"]


class BudgetSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    available = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Budget
        fields = [
            "id",
            "department",
            "department_name",
            "month",
            "limit",
            "spent",
            "reserved",
            "available",
        ]
        read_only_fields = ["spent", "reserved"]
        validators = []
        extra_kwargs = {
            "limit": {"min_value": Decimal("0"), "max_value": Decimal("999999999999.99")}
        }

    def validate_month(self, value):
        if value.day != 1:
            raise serializers.ValidationError("Укажите первый день месяца.")
        return value


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "tax_id", "contact", "email", "phone", "notes"]

    def validate_tax_id(self, value):
        if not value.isdigit() or len(value) not in (10, 12):
            raise serializers.ValidationError("ИНН должен содержать 10 или 12 цифр.")
        return value


class ItemSerializer(serializers.ModelSerializer):
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = RequisitionItem
        fields = ["id", "name", "quantity", "unit_price", "received_quantity", "total"]
        read_only_fields = ["id", "received_quantity"]
        extra_kwargs = {
            "quantity": {"min_value": 1, "max_value": 100000},
            "unit_price": {"min_value": Decimal("0.01"), "max_value": Decimal("9999999999.99")},
        }


class QuoteSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = Quote
        fields = ["id", "supplier", "supplier_name", "amount", "delivery_days", "notes"]
        extra_kwargs = {
            "amount": {"min_value": Decimal("0.01")},
            "delivery_days": {"min_value": 1, "max_value": 365},
        }


class EventSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.display_name")

    class Meta:
        model = Event
        fields = ["id", "actor_name", "action", "comment", "created_at"]


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ["id", "original_name", "size", "created_at"]


class PurchaseSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="quote.supplier.name")

    class Meta:
        model = Purchase
        fields = ["id", "amount", "supplier_name", "expected_on", "created_at"]


class RequisitionSerializer(serializers.ModelSerializer):
    number = serializers.CharField(read_only=True)
    author_name = serializers.CharField(source="author.display_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    items = ItemSerializer(many=True)
    quotes = QuoteSerializer(many=True, read_only=True)
    events = EventSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    purchase = PurchaseSerializer(read_only=True)

    class Meta:
        model = Requisition
        fields = [
            "id",
            "number",
            "title",
            "description",
            "author",
            "author_name",
            "department",
            "department_name",
            "needed_by",
            "status",
            "status_label",
            "total",
            "approved_amount",
            "items",
            "quotes",
            "events",
            "attachments",
            "purchase",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["author", "status", "approved_amount"]

    def validate(self, attrs):
        user = self.context["request"].user
        department = attrs.get("department")
        if user.role not in (User.Role.ADMIN, User.Role.BUYER) and (
            not department or department.pk != user.department_id
        ):
            raise serializers.ValidationError({"department": "Выберите свой отдел."})
        items = attrs.get("items", [])
        if not 1 <= len(items) <= 50:
            raise serializers.ValidationError({"items": "Добавьте от 1 до 50 позиций."})
        if sum((item["quantity"] * item["unit_price"] for item in items), Decimal("0")) > Decimal(
            "999999999999.99"
        ):
            raise serializers.ValidationError({"items": "Превышена максимальная сумма заявки."})
        if attrs.get("needed_by", timezone.localdate()) < timezone.localdate():
            raise serializers.ValidationError(
                {"needed_by": "Выберите сегодняшнюю или будущую дату."}
            )
        return attrs

    def create(self, validated_data):
        return save_requisition(self.context["request"].user, validated_data)

    def update(self, instance, validated_data):
        return save_requisition(self.context["request"].user, validated_data, instance)


class DecisionInput(serializers.Serializer):
    decision = serializers.ChoiceField(choices=["approve", "return", "reject"])
    comment = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")


class OrderInput(serializers.Serializer):
    quote_id = serializers.IntegerField(min_value=1)
    expected_on = serializers.DateField()


class ReceivedItemInput(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1, max_value=100000)


class ReceiveInput(serializers.Serializer):
    items = ReceivedItemInput(many=True, allow_empty=False, max_length=50)
