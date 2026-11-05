from datetime import date

from django.db import connection
from django.db.models import Sum
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Department, User

from . import services
from .models import Attachment, Budget, Event, Requisition, Supplier
from .permissions import require_role, visible_requisitions
from .serializers import (
    AttachmentSerializer,
    BudgetSerializer,
    DecisionInput,
    DepartmentSerializer,
    EventSerializer,
    OrderInput,
    QuoteSerializer,
    ReceiveInput,
    RequisitionSerializer,
    SupplierSerializer,
)


def month_filter(request):
    raw = request.query_params.get("month", timezone.localdate().strftime("%Y-%m"))
    try:
        return date.fromisoformat(raw + "-01")
    except ValueError as exc:
        raise ValidationError("Месяц должен быть в формате ГГГГ-ММ.") from exc


def budgets_for(user, month):
    qs = Budget.objects.select_related("department").filter(month=month)
    if user.role not in (User.Role.ADMIN, User.Role.BUYER):
        qs = qs.filter(department_id=user.department_id)
    return qs


class HealthView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        connection.ensure_connection()
        return Response({"status": "ok"})


class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DepartmentSerializer
    queryset = Department.objects.all()

    def get_queryset(self):
        if self.request.user.role in (User.Role.ADMIN, User.Role.BUYER):
            return self.queryset
        return self.queryset.filter(pk=self.request.user.department_id)


class SupplierViewSet(viewsets.ModelViewSet):
    serializer_class = SupplierSerializer
    queryset = Supplier.objects.all()
    http_method_names = ["get", "post", "put", "head", "options"]

    def perform_create(self, serializer):
        require_role(self.request.user, User.Role.ADMIN, User.Role.BUYER)
        serializer.save()

    def perform_update(self, serializer):
        require_role(self.request.user, User.Role.ADMIN, User.Role.BUYER)
        serializer.save()


class BudgetViewSet(viewsets.GenericViewSet):
    serializer_class = BudgetSerializer

    def list(self, request):
        return Response(
            self.get_serializer(budgets_for(request.user, month_filter(request)), many=True).data
        )

    def create(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        budget = services.set_budget(request.user, data.validated_data)
        return Response(self.get_serializer(budget).data, status=status.HTTP_200_OK)


class RequisitionViewSet(viewsets.ModelViewSet):
    serializer_class = RequisitionSerializer
    http_method_names = ["get", "post", "put", "head", "options"]

    def get_queryset(self):
        qs = visible_requisitions(self.request.user, Requisition.objects.all())
        return qs.select_related(
            "author", "department", "purchase__quote__supplier"
        ).prefetch_related("items", "quotes__supplier", "events__actor", "attachments")

    def list(self, request):
        qs = self.get_queryset()
        if value := request.query_params.get("status"):
            qs = qs.filter(status=value)
        if value := request.query_params.get("department"):
            if not value.isdigit():
                raise ValidationError("Некорректный отдел.")
            qs = qs.filter(department_id=value)
        if value := request.query_params.get("search", "").strip():
            qs = qs.filter(title__icontains=value[:180])
        return Response(self.get_serializer(qs[:200], many=True).data)

    def transition(self, request, fn, **kwargs):
        req = self.get_object()
        fn(req.pk, request.user, **kwargs)
        return Response(self.get_serializer(self.get_object()).data)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        return self.transition(request, services.submit)

    @action(detail=True, methods=["post"])
    def decision(self, request, pk=None):
        data = DecisionInput(data=request.data)
        data.is_valid(raise_exception=True)
        return self.transition(request, services.decide, **data.validated_data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self.transition(request, services.cancel)

    @action(detail=True, methods=["post"])
    def quotes(self, request, pk=None):
        req = self.get_object()
        data = QuoteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        quote = services.add_quote(req.pk, request.user, data.validated_data)
        return Response(QuoteSerializer(quote).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def order(self, request, pk=None):
        data = OrderInput(data=request.data)
        data.is_valid(raise_exception=True)
        return self.transition(request, services.order, **data.validated_data)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        data = ReceiveInput(data=request.data)
        data.is_valid(raise_exception=True)
        return self.transition(request, services.receive, **data.validated_data)

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def attachments(self, request, pk=None):
        req = self.get_object()
        file = request.FILES.get("file")
        if getattr(request._request, "upload_limit_exceeded", False):
            raise ValidationError("Выберите файл размером до 10 МБ.")
        attachment = services.add_attachment(req.pk, request.user, file)
        return Response(AttachmentSerializer(attachment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def comments(self, request, pk=None):
        req = self.get_object()
        comment = request.data.get("comment", "")
        if not isinstance(comment, str) or not 1 <= len(comment.strip()) <= 2000:
            raise ValidationError("Комментарий должен содержать от 1 до 2000 символов.")
        services.record(req, request.user, "Комментарий", comment.strip())
        return Response({"detail": "Комментарий добавлен."}, status=status.HTTP_201_CREATED)


class AttachmentDownloadView(APIView):
    def get(self, request, pk):
        attachment = get_object_or_404(Attachment, pk=pk)
        if not visible_requisitions(
            request.user, Requisition.objects.filter(pk=attachment.requisition_id)
        ).exists():
            raise PermissionDenied()
        response = FileResponse(
            attachment.file.open("rb"),
            as_attachment=True,
            filename=attachment.original_name,
            content_type="application/octet-stream",
        )
        response["Content-Security-Policy"] = "sandbox; default-src 'none'"
        response["X-Content-Type-Options"] = "nosniff"
        response["Cache-Control"] = "private, no-store"
        return response


class OverviewView(APIView):
    def get(self, request):
        month = month_filter(request)
        budgets = budgets_for(request.user, month)
        totals = budgets.aggregate(limit=Sum("limit"), spent=Sum("spent"), reserved=Sum("reserved"))
        totals = {key: value or 0 for key, value in totals.items()}
        totals["available"] = totals["limit"] - totals["spent"] - totals["reserved"]
        reqs = visible_requisitions(request.user, Requisition.objects.all())
        pending = (
            reqs.filter(status=Requisition.Status.PENDING)
            .exclude(author=request.user)
            .select_related("author", "department")
            .prefetch_related("items", "quotes", "events", "attachments")
            .order_by("needed_by", "id")[:4]
        )
        events = Event.objects.filter(requisition__in=reqs).select_related("actor")[:8]
        return Response(
            {
                "month": month,
                "totals": totals,
                "budgets": BudgetSerializer(budgets, many=True).data,
                "pending": RequisitionSerializer(pending, many=True).data,
                "events": EventSerializer(events, many=True).data,
                "counts": {s: reqs.filter(status=s).count() for s in Requisition.Status.values},
            }
        )
