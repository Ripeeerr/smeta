import os
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Department, User
from purchasing import services
from purchasing.models import Budget, Supplier


class Command(BaseCommand):
    help = "Создать демонстрационные отделы, пользователей и закупки"

    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Демонстрационные данные доступны только при DJANGO_DEBUG=1.")
        password = os.getenv("DEMO_PASSWORD", "")
        if len(password) < 12:
            raise CommandError("Укажите DEMO_PASSWORD длиной не менее 12 символов.")
        if User.objects.filter(username="director").exists():
            self.stdout.write("Демонстрационные данные уже созданы. Существующие записи сохранены.")
            return
        today = timezone.localdate()
        month = today.replace(day=1)
        departments = {
            name: Department.objects.get_or_create(name=name)[0]
            for name in ["Продажи", "Администрация", "Бухгалтерия", "ИТ"]
        }
        people = [
            ("director", "Алексей", "Котов", User.Role.ADMIN, None),
            ("manager", "Елена", "Маркова", User.Role.MANAGER, "Продажи"),
            ("buyer", "Дмитрий", "Волков", User.Role.BUYER, "Администрация"),
            ("employee", "Мария", "Орлова", User.Role.EMPLOYEE, "Продажи"),
            ("accountant", "Анна", "Белова", User.Role.EMPLOYEE, "Бухгалтерия"),
            ("engineer", "Илья", "Соколов", User.Role.EMPLOYEE, "ИТ"),
        ]
        users = {}
        for username, first, last, role, department in people:
            users[username] = User.objects.create_user(
                username=username,
                password=password,
                first_name=first,
                last_name=last,
                role=role,
                department=departments.get(department),
            )
        for department, limit in [
            ("Продажи", 400000),
            ("Администрация", 300000),
            ("Бухгалтерия", 200000),
            ("ИТ", 300000),
        ]:
            Budget.objects.create(department=departments[department], month=month, limit=limit)
        suppliers = [
            Supplier.objects.create(
                name="ООО «ТехноПроф»",
                tax_id="7701234567",
                contact="Андрей Морозов",
                email="sales@technoprof.example",
                phone="+7 (495) 123-45-67",
                notes="Оборудование для рабочих мест. Доставка 3–5 дней.",
            ),
            Supplier.objects.create(
                name="ООО «ОфисМаркет»",
                tax_id="7702345678",
                contact="Ольга Лебедева",
                email="order@officemarket.example",
                phone="+7 (495) 234-56-78",
                notes="Канцелярия и расходные материалы. Оплата по счёту.",
            ),
            Supplier.objects.create(
                name="ООО «Рабочая среда»",
                tax_id="7703456789",
                contact="Павел Петров",
                email="hello@workspace.example",
                phone="+7 (495) 345-67-89",
                notes="Мебель и оснащение офисов. Сборка включена.",
            ),
        ]

        def create(title, department, author, amount, state="pending", supplier=0, quantity=1):
            price = Decimal(str(amount)) / quantity
            req = services.save_requisition(
                users[author],
                {
                    "title": title,
                    "description": f"{title}. Закупка для обеспечения работы отдела. Требуется доставка в офис и комплект закрывающих документов.",
                    "department": departments[department],
                    "needed_by": today + timedelta(days=5),
                    "items": [{"name": title, "quantity": quantity, "unit_price": price}],
                },
            )
            services.submit(req.pk, users[author])
            if state in ("approved", "ordered", "received"):
                services.decide(req.pk, users["director"], "approve")
                quote = services.add_quote(
                    req.pk,
                    users["buyer"],
                    {
                        "supplier": suppliers[supplier],
                        "amount": Decimal(str(amount)),
                        "delivery_days": 3,
                    },
                )
                if state in ("ordered", "received"):
                    services.order(req.pk, users["buyer"], quote.pk, today + timedelta(days=3))
                if state == "received":
                    item = req.items.get()
                    services.receive(
                        req.pk, users["buyer"], [{"id": item.pk, "quantity": quantity}]
                    )
            return req

        create("Годовые лицензии для отдела продаж", "Продажи", "employee", 232000, "received")
        create("Обустройство переговорной", "Администрация", "buyer", 148400, "received", 2)
        create("Ноутбук для бухгалтера", "Бухгалтерия", "accountant", 89000, "received")
        create("Расходные материалы для офиса", "Бухгалтерия", "accountant", 60000, "ordered", 1)
        create("Обновление серверного оборудования", "ИТ", "engineer", 154600, "ordered")
        create("Кресла для нового офиса", "Администрация", "buyer", 74000, "approved", 2, 8)
        create("Гарнитуры для отдела продаж", "Продажи", "employee", 42000, "approved", 0, 6)
        create("Система резервного копирования", "ИТ", "engineer", 100000, "approved")
        create("Мониторы для отдела продаж", "Продажи", "employee", 96000, quantity=6)
        create("Сетевое оборудование", "ИТ", "engineer", 52800)
        create("Бумага и расходники", "Бухгалтерия", "accountant", 18400, supplier=1)
        self.stdout.write(self.style.SUCCESS("Демонстрационное пространство создано."))
        self.stdout.write(
            "Логины: director, manager, buyer, employee, accountant, engineer. Пароль: значение DEMO_PASSWORD."
        )
