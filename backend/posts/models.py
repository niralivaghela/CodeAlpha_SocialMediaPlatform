import os
import re
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

def post_media_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"posts/user_{instance.author.id}_{int(timezone.now().timestamp())}{ext}"

class Hashtag(models.Model):
    name = models.CharField(max_length=100, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"#{self.name}"

class Post(models.Model):
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(max_length=2000, blank=True, default='')
    image = models.ImageField(upload_to=post_media_path, blank=True, null=True)
    hashtags = models.ManyToManyField(Hashtag, through='PostHashtag', related_name='posts', blank=True)
    location = models.CharField(max_length=150, blank=True, default='')
    feeling = models.CharField(max_length=100, blank=True, default='')
    allow_comments = models.BooleanField(default=True)
    visibility = models.CharField(max_length=20, default='everyone', choices=[
        ('everyone', 'Everyone'),
        ('followers', 'Followers Only'),
        ('only_me', 'Only Me'),
    ])
    repost_of = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='reposts')
    is_pinned = models.BooleanField(default=False)
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Post #{self.id} by @{self.author.username}"

    @property
    def reposts_count(self):
        return self.reposts.count()

    def extract_hashtags(self):
        # Extract hashtags from content (e.g. #vibely, #tech)
        tags = set(re.findall(r'#(\w+)', self.content.lower()))
        self.hashtags.clear()
        for tag_name in tags:
            tag, _ = Hashtag.objects.get_or_create(name=tag_name)
            PostHashtag.objects.get_or_create(post=self, hashtag=tag)

class PostHashtag(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    hashtag = models.ForeignKey(Hashtag, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'hashtag')

class Poll(models.Model):
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name='poll')
    question = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Poll: {self.question}"

    @property
    def total_votes(self):
        return PollVote.objects.filter(poll=self).count()

class PollOption(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=150)

    def __str__(self):
        return f"{self.poll.id} - {self.text}"

    @property
    def vote_count(self):
        return self.votes.count()

class PollVote(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    poll_option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='poll_votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('poll', 'user')

class Like(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"@{self.user.username} liked #{self.post.id}"

class Bookmark(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='bookmarks')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"@{self.user.username} saved #{self.post.id}"

def story_media_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"stories/user_{instance.user.id}_{int(timezone.now().timestamp())}{ext}"

class Story(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='stories')
    media = models.ImageField(upload_to=story_media_path, blank=True, null=True)
    caption = models.CharField(max_length=280, blank=True, default='')
    background_color = models.CharField(max_length=50, default='linear-gradient(135deg, #FF6B6B, #FFA07A)')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Story #{self.id} by @{self.user.username}"

    @property
    def is_active(self):
        return self.created_at >= timezone.now() - timezone.timedelta(hours=24)

class StoryView(models.Model):
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='story_views')
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('story', 'viewer')
        ordering = ['-viewed_at']

    def __str__(self):
        return f"@{self.viewer.username} viewed Story #{self.story.id}"

class StoryHighlight(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='highlights')
    title = models.CharField(max_length=60)
    cover_image = models.ImageField(upload_to='highlights/', blank=True, null=True)
    stories = models.ManyToManyField(Story, related_name='highlights', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Highlight '{self.title}' by @{self.user.username}"

class Reaction(models.Model):
    REACTION_CHOICES = [
        ('like', 'Like'),
        ('love', 'Love'),
        ('funny', 'Funny'),
        ('celebrate', 'Celebrate'),
        ('wow', 'Wow'),
        ('sad', 'Sad'),
    ]
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_reactions')
    reaction_type = models.CharField(max_length=20, choices=REACTION_CHOICES, default='like')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('post', 'user')
        ordering = ['-created_at']

    def __str__(self):
        return f"@{self.user.username} reacted {self.reaction_type} to #{self.post.id}"

class PostDraft(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='drafts')
    content = models.TextField(max_length=2000, blank=True, default='')
    location = models.CharField(max_length=150, blank=True, default='')
    feeling = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Draft #{self.id} by @{self.user.username}"

class BookmarkCollection(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='collections')
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['name']

    def __str__(self):
        return f"Collection '{self.name}' by @{self.user.username}"

class BookmarkCollectionItem(models.Model):
    collection = models.ForeignKey(BookmarkCollection, on_delete=models.CASCADE, related_name='items')
    bookmark = models.ForeignKey(Bookmark, on_delete=models.CASCADE, related_name='collection_items')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('collection', 'bookmark')
