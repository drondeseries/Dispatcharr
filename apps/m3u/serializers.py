from rest_framework import serializers
from rest_framework.response import Response
from .models import M3UAccount, M3UFilter, ServerGroup, M3UAccountProfile
from core.models import UserAgent
from apps.channels.models import ChannelGroup, ChannelGroupM3UAccount
from apps.channels.serializers import (
    ChannelGroupM3UAccountSerializer,
    ChannelGroupSerializer,
)
import logging

logger = logging.getLogger(__name__)


class M3UFilterSerializer(serializers.ModelSerializer):
    """Serializer for M3U Filters"""

    channel_groups = ChannelGroupM3UAccountSerializer(source="m3u_account", many=True)

    class Meta:
        model = M3UFilter
        fields = ["id", "filter_type", "regex_pattern", "exclude", "channel_groups"]


class M3UAccountProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = M3UAccountProfile
        fields = [
            "id",
            "name",
            "max_streams",
            "is_active",
            "is_default",
            "current_viewers",
            "search_pattern",
            "replace_pattern",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        m3u_account = self.context.get("m3u_account")

        # Use the m3u_account when creating the profile
        validated_data["m3u_account_id"] = m3u_account.id

        return super().create(validated_data)

    def update(self, instance, validated_data):
        if instance.is_default:
            raise serializers.ValidationError("Default profiles cannot be modified.")
        return super().update(instance, validated_data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_default:
            return Response(
                {"error": "Default profiles cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class M3UAccountSerializer(serializers.ModelSerializer):
    """Serializer for M3U Account"""

    filters = M3UFilterSerializer(many=True, read_only=True)
    # Include user_agent as a mandatory field using its primary key.
    user_agent = serializers.PrimaryKeyRelatedField(
        queryset=UserAgent.objects.all(),
        required=False,
        allow_null=True,
    )
    profiles = M3UAccountProfileSerializer(many=True, read_only=True)
    read_only_fields = ["locked", "created_at", "updated_at"]
    # channel_groups = serializers.SerializerMethodField()
    channel_groups = ChannelGroupM3UAccountSerializer(
        source="channel_group", many=True, required=False
    )

    class Meta:
        model = M3UAccount
        fields = [
            "id",
            "name",
            "server_url",
            "file_path",
            "server_group",
            "max_streams",
            "is_active",
            "created_at",
            "updated_at",
            "filters",
            "user_agent",
            "profiles",
            "locked",
            "channel_groups",
            "refresh_interval",
            "custom_properties",
            "account_type",
            "username",
            "password",
            "stale_stream_days",
            "status",
            "last_message",
        ]
        extra_kwargs = {
            "password": {
                "required": False,
                "allow_blank": True,
            },
        }

    def update(self, instance, validated_data):
        # Pop out channel group memberships so we can handle them manually
        channel_group_data = validated_data.pop("channel_group", [])

        # First, update the M3UAccount itself
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Prepare a list of memberships to update
        memberships_to_update = []
        for group_data in channel_group_data:
            group = group_data.get("channel_group")
            enabled = group_data.get("enabled")

            try:
                membership = ChannelGroupM3UAccount.objects.get(
                    m3u_account=instance, channel_group=group
                )
                membership.enabled = enabled
                memberships_to_update.append(membership)
            except ChannelGroupM3UAccount.DoesNotExist:
                continue

        # Perform the bulk update
        if memberships_to_update:
            ChannelGroupM3UAccount.objects.bulk_update(
                memberships_to_update, ["enabled"]
            )

        return instance


class ServerGroupSerializer(serializers.ModelSerializer):
    """Serializer for Server Group"""

    class Meta:
        model = ServerGroup
        fields = ["id", "name"]
