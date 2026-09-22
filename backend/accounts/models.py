import os
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

def avatar_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"avatars/user_{instance.user.id}_{int(timezone.now().timestamp())}{ext}"

def banner_upload_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"banners/user_{instance.user.id}_{int(timezone.now().timestamp())}{ext}"

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(max_length=500, blank=True, default='')
    avatar = models.ImageField(upload_to=avatar_upload_path, blank=True, null=True)
    banner = models.ImageField(upload_to=banner_upload_path, blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, default='')
    website = models.URLField(max_length=200, blank=True, default='')
    is_private = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    is_deactivated = models.BooleanField(default=False)
    pinned_post = models.ForeignKey('posts.Post', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    who_can_message = models.CharField(max_length=20, default='everyone', choices=[
        ('everyone', 'Everyone'),
        ('followers', 'Followers Only'),
        ('nobody', 'Nobody'),
    ])
    who_can_comment = models.CharField(max_length=20, default='everyone', choices=[
        ('everyone', 'Everyone'),
        ('followers', 'Followers Only'),
    ])
    last_seen = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"@{self.user.username}'s profile"

    @property
    def display_name(self):
        full = f"{self.user.first_name} {self.user.last_name}".strip()
        return full if full else self.user.username

    @property
    def initials(self):
        first = (self.user.first_name or '').strip()
        last = (self.user.last_name or '').strip()
        if first and last:
            return f"{first[0]}{last[0]}".upper()
        if first:
            return first[:2].upper()
        username = self.user.username.strip()
        return username[:2].upper() if len(username) >= 2 else username[:1].upper()

    @property
    def is_online(self):
        # Online if active in the last 3 minutes
        diff = timezone.now() - self.last_seen
        return diff.total_seconds() < 180

    @property
    def presence_status(self):
        diff = (timezone.now() - self.last_seen).total_seconds()
        if diff < 180:
            return 'online'
        elif diff < 600:
            return 'away'
        return 'offline'
