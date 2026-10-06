from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


def user_data(user):
    return {
        "id": user.pk,
        "username": user.username,
        "name": user.display_name,
        "role": user.role,
        "role_label": user.get_role_display(),
        "department": user.department_id,
        "department_name": user.department.name if user.department_id else None,
    }


class SessionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "user": user_data(request.user) if request.user.is_authenticated else None,
                "csrf_token": get_token(request),
            }
        )


class LoginInput(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=256, trim_whitespace=False)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        data = LoginInput(data=request.data)
        data.is_valid(raise_exception=True)
        user = authenticate(request, **data.validated_data)
        if user is None:
            return Response(
                {"detail": "Неверный логин или пароль."}, status=status.HTTP_400_BAD_REQUEST
            )
        login(request, user)
        return Response({"user": user_data(user), "csrf_token": get_token(request)})


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"user": None, "csrf_token": get_token(request)})
