from django.db import models
from django.contrib.auth.models import User
from posts.models import Post
from comments.models import Comment

class Notification(models.Model):
    ACTION_CHOICES = [
        ('like', 'liked your post'),
        ('reaction', 'reacted to your post'),
        ('comment', 'commented on your post'),
        ('reply', 'replied to your comment'),
        ('follow', 'started following you'),
        ('follow_request', 'requested to follow you'),
        ('follow_accept', 'accepted your follow request'),
        ('mention', 'mentioned you in a post'),
        ('repost', 'shared your post'),
        ('story_view', 'viewed your moment'),
    ]

    CATEGORY_CHOICES = [
        ('all', 'All'),
        ('social', 'Social'),
        ('mentions', 'Mentions'),
        ('messages', 'Messages'),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='caused_notifications')
    action_type = models.CharField(max_length=20, choices=ACTION_CHOICES)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='social')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification: @{self.actor.username} {self.action_type} for @{self.recipient.username}"
