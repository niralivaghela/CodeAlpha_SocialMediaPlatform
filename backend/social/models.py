from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class Follow(models.Model):
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following_set')
    following = models.ForeignKey(User, on_delete=models.CASCADE, related_name='follower_set')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')
        ordering = ['-created_at']

    def clean(self):
        if self.follower == self.following:
            raise ValidationError("Users cannot follow themselves.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"@{self.follower.username} follows @{self.following.username}"

class Block(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_users')
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_by_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')
        ordering = ['-created_at']

    def clean(self):
        if self.blocker == self.blocked:
            raise ValidationError("Users cannot block themselves.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)
        # When a user is blocked, remove any active follow relationships between them
        Follow.objects.filter(follower=self.blocker, following=self.blocked).delete()
        Follow.objects.filter(follower=self.blocked, following=self.blocker).delete()

    def __str__(self):
        return f"@{self.blocker.username} blocked @{self.blocked.username}"

class Report(models.Model):
    REASON_CHOICES = [
        ('spam', 'Spam'),
        ('harassment', 'Harassment or bullying'),
        ('inappropriate', 'Inappropriate content'),
        ('fake_account', 'Fake account / Impersonation'),
        ('other', 'Other'),
    ]

    TARGET_CHOICES = [
        ('post', 'Post'),
        ('comment', 'Comment'),
        ('user', 'User'),
    ]

    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='filed_reports')
    target_type = models.CharField(max_length=20, choices=TARGET_CHOICES)
    target_id = models.IntegerField()
    reason = models.CharField(max_length=30, choices=REASON_CHOICES)
    details = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('resolved', 'Resolved'),
        ('dismissed', 'Dismissed'),
    ], default='pending')
    resolved_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='resolved_reports')
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report #{self.id} ({self.status}) by @{self.reporter.username} on {self.target_type} {self.target_id}"

class FollowRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    ]
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_follow_requests')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_follow_requests')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('sender', 'recipient')
        ordering = ['-created_at']

    def __str__(self):
        return f"Request from @{self.sender.username} to @{self.recipient.username} ({self.status})"

class Mute(models.Model):
    muter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='muted_users')
    muted = models.ForeignKey(User, on_delete=models.CASCADE, related_name='muted_by_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('muter', 'muted')
        ordering = ['-created_at']

    def __str__(self):
        return f"@{self.muter.username} muted @{self.muted.username}"

class HiddenPost(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hidden_posts')
    post = models.ForeignKey('posts.Post', on_delete=models.CASCADE, related_name='hidden_by_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')
        ordering = ['-created_at']

    def __str__(self):
        return f"@{self.user.username} hid post #{self.post_id}"
