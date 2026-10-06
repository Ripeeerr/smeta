import django.db.models.deletion
import django.db.models.expressions
from django.conf import settings
from django.db import migrations, models

import purchasing.models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Supplier",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("name", models.CharField(max_length=160)),
                ("tax_id", models.CharField(max_length=12, unique=True)),
                ("contact", models.CharField(blank=True, max_length=160)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("phone", models.CharField(blank=True, max_length=32)),
                ("notes", models.TextField(blank=True, max_length=2000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="Budget",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("month", models.DateField()),
                ("limit", models.DecimalField(decimal_places=2, max_digits=14)),
                ("reserved", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("spent", models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="budgets",
                        to="accounts.department",
                    ),
                ),
            ],
            options={
                "ordering": ["department__name"],
            },
        ),
        migrations.CreateModel(
            name="Requisition",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("title", models.CharField(max_length=180)),
                ("description", models.TextField(max_length=4000)),
                ("needed_by", models.DateField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Черновик"),
                            ("pending", "На согласовании"),
                            ("returned", "На доработке"),
                            ("approved", "К закупке"),
                            ("ordered", "В пути"),
                            ("received", "Получено"),
                            ("rejected", "Отклонено"),
                            ("cancelled", "Отменено"),
                        ],
                        default="draft",
                        max_length=12,
                    ),
                ),
                (
                    "approved_amount",
                    models.DecimalField(decimal_places=2, default=0, max_digits=14),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="requisitions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "budget",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        to="purchasing.budget",
                    ),
                ),
                (
                    "department",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="accounts.department"
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="Quote",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("delivery_days", models.PositiveSmallIntegerField()),
                ("notes", models.TextField(blank=True, max_length=2000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "requisition",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="quotes",
                        to="purchasing.requisition",
                    ),
                ),
                (
                    "supplier",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="purchasing.supplier"
                    ),
                ),
            ],
            options={
                "ordering": ["amount", "id"],
            },
        ),
        migrations.CreateModel(
            name="Purchase",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("expected_on", models.DateField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "ordered_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL
                    ),
                ),
                (
                    "quote",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to="purchasing.quote"
                    ),
                ),
                (
                    "requisition",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="purchase",
                        to="purchasing.requisition",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="Event",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("action", models.CharField(max_length=160)),
                ("comment", models.TextField(blank=True, max_length=2000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL
                    ),
                ),
                (
                    "requisition",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="events",
                        to="purchasing.requisition",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="Attachment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("original_name", models.CharField(max_length=180)),
                ("file", models.FileField(upload_to=purchasing.models.attachment_path)),
                ("size", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "uploaded_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL
                    ),
                ),
                (
                    "requisition",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attachments",
                        to="purchasing.requisition",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="RequisitionItem",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("name", models.CharField(max_length=180)),
                ("quantity", models.PositiveIntegerField()),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=12)),
                ("received_quantity", models.PositiveIntegerField(default=0)),
                (
                    "requisition",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="purchasing.requisition",
                    ),
                ),
            ],
            options={
                "ordering": ["id"],
            },
        ),
        migrations.AddConstraint(
            model_name="budget",
            constraint=models.UniqueConstraint(
                fields=("department", "month"), name="unique_department_month"
            ),
        ),
        migrations.AddConstraint(
            model_name="budget",
            constraint=models.CheckConstraint(
                condition=models.Q(("limit__gte", 0), ("reserved__gte", 0), ("spent__gte", 0)),
                name="nonnegative_budget",
            ),
        ),
        migrations.AddConstraint(
            model_name="budget",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "limit__gte",
                        django.db.models.expressions.CombinedExpression(
                            models.F("spent"), "+", models.F("reserved")
                        ),
                    )
                ),
                name="budget_within_limit",
            ),
        ),
        migrations.AddIndex(
            model_name="requisition",
            index=models.Index(
                fields=["department", "status"], name="purchasing__departm_63b3ed_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="requisition",
            index=models.Index(fields=["needed_by"], name="purchasing__needed__8c975b_idx"),
        ),
        migrations.AddConstraint(
            model_name="requisitionitem",
            constraint=models.CheckConstraint(
                condition=models.Q(("quantity__gt", 0), ("unit_price__gt", 0)),
                name="positive_item_values",
            ),
        ),
        migrations.AddConstraint(
            model_name="requisitionitem",
            constraint=models.CheckConstraint(
                condition=models.Q(("received_quantity__lte", models.F("quantity"))),
                name="received_within_quantity",
            ),
        ),
        migrations.AddConstraint(
            model_name="quote",
            constraint=models.CheckConstraint(
                condition=models.Q(("amount__gt", 0), ("delivery_days__gt", 0)),
                name="positive_quote_values",
            ),
        ),
        migrations.AddConstraint(
            model_name="quote",
            constraint=models.UniqueConstraint(
                fields=("requisition", "supplier"), name="unique_supplier_quote"
            ),
        ),
    ]
