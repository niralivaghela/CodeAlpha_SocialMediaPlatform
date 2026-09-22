from django.urls import path
from .views import (
    RegisterView, LoginView, LogoutView, MeView, ChangePasswordView,
    ActiveSessionsView, DeactivateAccountView, DeleteAccountView,
    UserDetailView, ProfileUpdateView, FollowToggleView, RemoveFollowerView,
    FollowersListView, FollowingListView, BlockToggleView,
    BlockedUsersListView, SuggestedUsersView, FollowRequestListView,
    FollowRequestActionView, MuteToggleView, MutedUsersListView,
    MutualFollowersListView,
    PostListCreateView, PostDetailView, PostLikeToggleView,
    PostReactionToggleView, PostBookmarkToggleView, PostVoteView,
    PostHideView, PostPinToggleView, PostDraftListCreateView,
    PostDraftDetailView, UserBookmarksView, BookmarkCollectionListCreateView,
    BookmarkCollectionItemToggleView, UserLikedPostsView,
    PostCommentsView, CommentLikeToggleView, CommentDeleteView,
    TrendingHashtagsView, PopularPostsView, SearchView,
    HashtagPostsView, NotificationListView, NotificationMarkReadView,
    NotificationMarkAllReadView, ConversationListView,
    StartConversationView, ConversationMessagesView, MessageDeleteView,
    MessageReactionView, MessagePinToggleView,
    ReportCreateView, StoryListCreateView, StoryViewRecordView,
    StoryHighlightListCreateView, UserActivityView,
    AdminStatsView, AdminReportsListView, AdminReportResolveView,
    AdminUserBanView, AdminPostDeleteView
)

urlpatterns = [
    # Auth & Security
    path('auth/register/', RegisterView.as_view(), name='auth-register'),
    path('auth/login/', LoginView.as_view(), name='auth-login'),
    path('auth/logout/', LogoutView.as_view(), name='auth-logout'),
    path('auth/me/', MeView.as_view(), name='auth-me'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='auth-change-password'),
    path('auth/sessions/', ActiveSessionsView.as_view(), name='auth-sessions'),
    path('auth/deactivate/', DeactivateAccountView.as_view(), name='auth-deactivate'),
    path('auth/delete/', DeleteAccountView.as_view(), name='auth-delete'),

    # Users, Profiles & Social Relations
    path('users/profile/', ProfileUpdateView.as_view(), name='profile-update'),
    path('users/suggested/', SuggestedUsersView.as_view(), name='users-suggested'),
    path('users/blocked/', BlockedUsersListView.as_view(), name='users-blocked'),
    path('users/muted/', MutedUsersListView.as_view(), name='users-muted'),
    path('users/follow-requests/', FollowRequestListView.as_view(), name='users-follow-requests'),
    path('users/follow-requests/<int:pk>/action/', FollowRequestActionView.as_view(), name='users-follow-request-action'),
    path('users/<str:username>/', UserDetailView.as_view(), name='user-detail'),
    path('users/<str:username>/follow/', FollowToggleView.as_view(), name='user-follow'),
    path('users/<str:username>/remove-follower/', RemoveFollowerView.as_view(), name='user-remove-follower'),
    path('users/<str:username>/mute/', MuteToggleView.as_view(), name='users-mute'),
    path('users/<str:username>/followers/', FollowersListView.as_view(), name='user-followers'),
    path('users/<str:username>/following/', FollowingListView.as_view(), name='user-following'),
    path('users/<str:username>/mutuals/', MutualFollowersListView.as_view(), name='users-mutuals'),
    path('users/<str:username>/block/', BlockToggleView.as_view(), name='user-block'),
    path('users/<str:username>/liked/', UserLikedPostsView.as_view(), name='user-liked-posts'),

    # Posts & Feeds
    path('posts/', PostListCreateView.as_view(), name='posts-list-create'),
    path('posts/drafts/', PostDraftListCreateView.as_view(), name='posts-drafts'),
    path('posts/drafts/<int:pk>/', PostDraftDetailView.as_view(), name='posts-draft-detail'),
    path('posts/bookmarks/', UserBookmarksView.as_view(), name='user-bookmarks'),
    path('posts/collections/', BookmarkCollectionListCreateView.as_view(), name='posts-collections'),
    path('posts/<int:pk>/', PostDetailView.as_view(), name='post-detail'),
    path('posts/<int:pk>/like/', PostLikeToggleView.as_view(), name='post-like'),
    path('posts/<int:pk>/react/', PostReactionToggleView.as_view(), name='post-react'),
    path('posts/<int:pk>/bookmark/', PostBookmarkToggleView.as_view(), name='post-bookmark'),
    path('posts/<int:pk>/collection/', BookmarkCollectionItemToggleView.as_view(), name='posts-collection-toggle'),
    path('posts/<int:pk>/hide/', PostHideView.as_view(), name='post-hide'),
    path('posts/<int:pk>/pin/', PostPinToggleView.as_view(), name='post-pin'),
    path('posts/<int:pk>/vote/', PostVoteView.as_view(), name='post-vote'),
    path('posts/<int:pk>/comments/', PostCommentsView.as_view(), name='post-comments'),

    # Comments
    path('comments/<int:pk>/', CommentDeleteView.as_view(), name='comment-delete'),
    path('comments/<int:pk>/like/', CommentLikeToggleView.as_view(), name='comment-like'),

    # Explore & Search
    path('explore/trending/', TrendingHashtagsView.as_view(), name='explore-trending'),
    path('explore/popular/', PopularPostsView.as_view(), name='explore-popular'),
    path('explore/tags/<str:name>/', HashtagPostsView.as_view(), name='explore-hashtag-posts'),
    path('search/', SearchView.as_view(), name='search'),

    # Notifications
    path('notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/read-all/', NotificationMarkAllReadView.as_view(), name='notifications-mark-all-read'),

    # Direct Messaging
    path('conversations/', ConversationListView.as_view(), name='conversations-list'),
    path('conversations/start/', StartConversationView.as_view(), name='conversation-start'),
    path('conversations/<int:pk>/messages/', ConversationMessagesView.as_view(), name='conversation-messages'),
    path('messages/<int:pk>/', MessageDeleteView.as_view(), name='message-delete'),
    path('messages/<int:pk>/react/', MessageReactionView.as_view(), name='message-react'),
    path('messages/<int:pk>/pin/', MessagePinToggleView.as_view(), name='message-pin'),

    # Stories / Moments & Highlights
    path('stories/', StoryListCreateView.as_view(), name='stories-list-create'),
    path('stories/<int:pk>/view/', StoryViewRecordView.as_view(), name='story-view'),
    path('stories/highlights/', StoryHighlightListCreateView.as_view(), name='story-highlights'),

    # User Real Activity & Analytics
    path('users/me/activity/', UserActivityView.as_view(), name='user-activity'),

    # Reports & Safety
    path('reports/', ReportCreateView.as_view(), name='reports-create'),
    path('social/report/', ReportCreateView.as_view(), name='social-reports-create'),
    path('social/mute/<str:username>/', MuteToggleView.as_view(), name='social-user-mute'),
    path('social/follow-requests/', FollowRequestListView.as_view(), name='social-follow-requests'),
    path('social/follow-requests/<int:pk>/action/', FollowRequestActionView.as_view(), name='social-follow-request-action'),
    path('bookmarks/collections/', BookmarkCollectionListCreateView.as_view(), name='bookmarks-collections-alias'),
    path('bookmarks/collections/<int:pk>/items/', BookmarkCollectionItemToggleView.as_view(), name='bookmarks-collection-items-alias'),
    path('posts/<int:pk>/reaction/', PostReactionToggleView.as_view(), name='post-reaction-alias'),

    # Admin & Moderation (Staff Only)
    path('admin-panel/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('admin-panel/reports/', AdminReportsListView.as_view(), name='admin-reports'),
    path('admin-panel/reports/<int:pk>/resolve/', AdminReportResolveView.as_view(), name='admin-report-resolve'),
    path('admin-panel/users/<str:username>/ban/', AdminUserBanView.as_view(), name='admin-user-ban'),
    path('admin-panel/posts/<int:pk>/', AdminPostDeleteView.as_view(), name='admin-post-delete-root'),
    path('admin-panel/posts/<int:pk>/delete/', AdminPostDeleteView.as_view(), name='admin-post-delete'),
]
