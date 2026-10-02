from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import LoginView, LogoutView, SessionView
from purchasing.views import (
    AttachmentDownloadView,
    BudgetViewSet,
    DepartmentViewSet,
    HealthView,
    OverviewView,
    RequisitionViewSet,
    SupplierViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet)
router.register("suppliers", SupplierViewSet)
router.register("budgets", BudgetViewSet, basename="budget")
router.register("requisitions", RequisitionViewSet, basename="requisition")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", HealthView.as_view()),
    path("api/auth/session/", SessionView.as_view()),
    path("api/auth/login/", LoginView.as_view()),
    path("api/auth/logout/", LogoutView.as_view()),
    path("api/overview/", OverviewView.as_view()),
    path("api/attachments/<int:pk>/", AttachmentDownloadView.as_view()),
    path("api/", include(router.urls)),
]
