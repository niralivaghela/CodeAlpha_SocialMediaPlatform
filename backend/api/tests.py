from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status
from posts.models import Post, Hashtag, Poll, PollOption, PollVote, Like, Bookmark, Reaction, PostDraft, BookmarkCollection, BookmarkCollectionItem, StoryHighlight
from comments.models import Comment, CommentLike
from social.models import Follow, Block, FollowRequest, Mute, HiddenPost, Report
from notifications.models import Notification
from messaging.models import Conversation, Message, MessageReaction

class VibelyAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Create User 1 (Alice)
        self.user1 = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='Password123!',
            first_name='Alice',
            last_name='Wonders'
        )
        # Create User 2 (Bob)
        self.user2 = User.objects.create_user(
            username='bob',
            email='bob@example.com',
            password='Password123!',
            first_name='Bob',
            last_name='Builder'
        )

    def test_user_registration(self):
        response = self.client.post('/api/auth/register/', {
            'full_name': 'Charlie Chaplin',
            'username': 'charlie',
            'email': 'charlie@example.com',
            'password': 'StrongPassword123!',
            'confirm_password': 'StrongPassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username='charlie').exists())
        charlie = User.objects.get(username='charlie')
        self.assertEqual(charlie.profile.initials, 'CC')

    def test_login_and_me(self):
        response = self.client.post('/api/auth/login/', {
            'username': 'alice',
            'password': 'Password123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Test /api/auth/me/
        me_resp = self.client.get('/api/auth/me/')
        self.assertEqual(me_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(me_resp.data['username'], 'alice')
        self.assertEqual(me_resp.data['initials'], 'AW')

    def test_post_creation_and_hashtags(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post('/api/posts/', {
            'content': 'Loving the vibe today! #vibely #python'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        post_id = response.data['id']
        post = Post.objects.get(id=post_id)
        self.assertEqual(post.hashtags.count(), 2)
        self.assertTrue(Hashtag.objects.filter(name='vibely').exists())

    def test_like_and_notification(self):
        # Alice creates a post
        post = Post.objects.create(author=self.user1, content='Hello world')
        # Bob likes Alice's post
        self.client.force_authenticate(user=self.user2)
        like_resp = self.client.post(f'/api/posts/{post.id}/like/')
        self.assertEqual(like_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(like_resp.data['is_liked'])
        self.assertEqual(like_resp.data['like_count'], 1)

        # Check notification created for Alice
        notif = Notification.objects.filter(recipient=self.user1, actor=self.user2, action_type='like').first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.post, post)

        # Unlike
        unlike_resp = self.client.post(f'/api/posts/{post.id}/like/')
        self.assertFalse(unlike_resp.data['is_liked'])
        self.assertEqual(unlike_resp.data['like_count'], 0)

    def test_comment_and_reply(self):
        post = Post.objects.create(author=self.user1, content='Let discuss')
        self.client.force_authenticate(user=self.user2)

        # Add comment
        comment_resp = self.client.post(f'/api/posts/{post.id}/comments/', {
            'content': 'Great topic!'
        })
        self.assertEqual(comment_resp.status_code, status.HTTP_201_CREATED)
        parent_comment_id = comment_resp.data['id']

        # Alice replies
        self.client.force_authenticate(user=self.user1)
        reply_resp = self.client.post(f'/api/posts/{post.id}/comments/', {
            'content': 'Thanks Bob!',
            'parent_id': parent_comment_id
        })
        self.assertEqual(reply_resp.status_code, status.HTTP_201_CREATED)

        # Verify nested comment structure
        get_comments = self.client.get(f'/api/posts/{post.id}/comments/')
        self.assertEqual(get_comments.status_code, status.HTTP_200_OK)
        self.assertEqual(len(get_comments.data), 1)
        self.assertEqual(len(get_comments.data[0]['replies']), 1)

    def test_follow_and_unfollow(self):
        self.client.force_authenticate(user=self.user1)
        # Cannot follow self
        self_resp = self.client.post(f'/api/users/{self.user1.username}/follow/')
        self.assertEqual(self_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # Follow Bob
        follow_resp = self.client.post(f'/api/users/{self.user2.username}/follow/')
        self.assertEqual(follow_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(follow_resp.data['is_following'])
        self.assertEqual(follow_resp.data['follower_count'], 1)

        # Notification created for Bob
        self.assertTrue(Notification.objects.filter(recipient=self.user2, actor=self.user1, action_type='follow').exists())

        # Unfollow Bob
        unfollow_resp = self.client.post(f'/api/users/{self.user2.username}/follow/')
        self.assertFalse(unfollow_resp.data['is_following'])
        self.assertEqual(unfollow_resp.data['follower_count'], 0)

    def test_poll_and_single_vote(self):
        self.client.force_authenticate(user=self.user1)
        # Create post with poll
        post_resp = self.client.post('/api/posts/', {
            'content': 'Pick a color',
            'poll_question': 'Favorite color?',
            'poll_options': '["Blue", "Green", "Purple"]'
        })
        self.assertEqual(post_resp.status_code, status.HTTP_201_CREATED)
        post_id = post_resp.data['id']
        options = post_resp.data['poll']['options']
        self.assertEqual(len(options), 3)

        # Bob votes
        self.client.force_authenticate(user=self.user2)
        vote_resp = self.client.post(f'/api/posts/{post_id}/vote/', {
            'option_id': options[0]['id']
        })
        self.assertEqual(vote_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(vote_resp.data['total_votes'], 1)

        # Duplicate vote rejected
        dup_vote = self.client.post(f'/api/posts/{post_id}/vote/', {
            'option_id': options[1]['id']
        })
        self.assertEqual(dup_vote.status_code, status.HTTP_400_BAD_REQUEST)

    def test_direct_messaging(self):
        self.client.force_authenticate(user=self.user1)
        # Start conversation with Bob
        conv_resp = self.client.post('/api/conversations/start/', {
            'username': self.user2.username
        })
        self.assertEqual(conv_resp.status_code, status.HTTP_200_OK)
        conv_id = conv_resp.data['id']

        # Alice sends message
        msg_resp = self.client.post(f'/api/conversations/{conv_id}/messages/', {
            'text': 'Hi Bob!'
        })
        self.assertEqual(msg_resp.status_code, status.HTTP_201_CREATED)

        # Bob reads messages
        self.client.force_authenticate(user=self.user2)
        get_msgs = self.client.get(f'/api/conversations/{conv_id}/messages/')
        self.assertEqual(len(get_msgs.data), 1)
        self.assertEqual(get_msgs.data[0]['text'], 'Hi Bob!')

    def test_block_user(self):
        self.client.force_authenticate(user=self.user1)
        # Create post by Alice
        post = Post.objects.create(author=self.user1, content="Alice's secret post")

        # Bob blocks Alice
        self.client.force_authenticate(user=self.user2)
        block_resp = self.client.post(f'/api/users/{self.user1.username}/block/')
        self.assertEqual(block_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(block_resp.data['is_blocked'])

        # Bob's feed must not contain Alice's post
        feed_resp = self.client.get('/api/posts/')
        post_ids = [p['id'] for p in feed_resp.data['results']]
        self.assertNotIn(post.id, post_ids)

        # Messaging between them must be rejected
        msg_attempt = self.client.post('/api/conversations/start/', {
            'username': self.user1.username
        })
        self.assertEqual(msg_attempt.status_code, status.HTTP_400_BAD_REQUEST)

    def test_multi_reactions(self):
        post = Post.objects.create(author=self.user1, content="Exciting platform updates!")
        self.client.force_authenticate(user=self.user2)

        # Bob reacts 'love'
        resp = self.client.post(f'/api/posts/{post.id}/reaction/', {'reaction_type': 'love'})
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['current_reaction'], 'love')
        self.assertEqual(resp.data['reactions_count']['love'], 1)
        self.assertEqual(resp.data['like_count'], 1)

        # Bob changes reaction to 'funny'
        resp2 = self.client.post(f'/api/posts/{post.id}/reaction/', {'reaction_type': 'funny'})
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data['current_reaction'], 'funny')
        self.assertEqual(resp2.data['reactions_count']['funny'], 1)
        self.assertEqual(resp2.data['reactions_count']['love'], 0)

        # Bob un-reacts by sending same reaction
        resp3 = self.client.post(f'/api/posts/{post.id}/reaction/', {'reaction_type': 'funny'})
        self.assertEqual(resp3.status_code, status.HTTP_200_OK)
        self.assertIsNone(resp3.data['current_reaction'])
        self.assertEqual(resp3.data['reactions_count']['funny'], 0)

    def test_quote_repost(self):
        original = Post.objects.create(author=self.user1, content="Original thought to quote")
        self.client.force_authenticate(user=self.user2)

        # Bob quotes Alice's post
        resp = self.client.post('/api/posts/', {
            'content': 'This is so true!',
            'repost_of': original.id
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(resp.data['repost_of_data'])
        self.assertEqual(resp.data['repost_of_data']['content'], "Original thought to quote")
        self.assertEqual(resp.data['repost_of_data']['author']['username'], 'alice')

        # Check original post repost count
        original.refresh_from_db()
        self.assertEqual(original.reposts_count, 1)

    def test_private_account_and_follow_request_flow(self):
        # Alice turns on private account
        self.user1.profile.is_private = True
        self.user1.profile.save()

        # Bob attempts to follow Alice
        self.client.force_authenticate(user=self.user2)
        follow_resp = self.client.post(f'/api/users/{self.user1.username}/follow/')
        self.assertEqual(follow_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(follow_resp.data['requested'])
        self.assertFalse(follow_resp.data['is_following'])

        # Alice checks pending follow requests
        self.client.force_authenticate(user=self.user1)
        req_list = self.client.get('/api/social/follow-requests/')
        self.assertEqual(req_list.status_code, status.HTTP_200_OK)
        self.assertEqual(len(req_list.data), 1)
        req_id = req_list.data[0]['id']

        # Alice accepts follow request
        action_resp = self.client.post(f'/api/social/follow-requests/{req_id}/action/', {
            'action': 'accept'
        })
        self.assertEqual(action_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(action_resp.data['status'], 'accepted')

        # Verify Bob is now officially following Alice
        self.assertTrue(Follow.objects.filter(follower=self.user2, following=self.user1).exists())

    def test_user_mute_and_post_hide(self):
        post = Post.objects.create(author=self.user1, content="Alice post for mute test")
        self.client.force_authenticate(user=self.user2)

        # Bob hides this post
        hide_resp = self.client.post(f'/api/posts/{post.id}/hide/')
        self.assertEqual(hide_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(hide_resp.data['is_hidden'])

        # Bob's feed excludes this post
        feed_resp = self.client.get('/api/posts/')
        post_ids = [p['id'] for p in feed_resp.data['results']]
        self.assertNotIn(post.id, post_ids)

        # Bob unhides post
        unhide_resp = self.client.post(f'/api/posts/{post.id}/hide/')
        self.assertFalse(unhide_resp.data['is_hidden'])

        # Bob mutes Alice
        mute_resp = self.client.post(f'/api/social/mute/{self.user1.username}/')
        self.assertEqual(mute_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(mute_resp.data['is_muted'])

        # Bob's feed now excludes all of Alice's posts
        feed_resp2 = self.client.get('/api/posts/')
        post_ids2 = [p['id'] for p in feed_resp2.data['results']]
        self.assertNotIn(post.id, post_ids2)

    def test_post_pinning(self):
        post1 = Post.objects.create(author=self.user1, content="First post")
        post2 = Post.objects.create(author=self.user1, content="Important pinned post")

        self.client.force_authenticate(user=self.user1)
        pin_resp = self.client.post(f'/api/posts/{post2.id}/pin/')
        self.assertEqual(pin_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(pin_resp.data['is_pinned'])

        # User profile reflects pinned post
        self.user1.profile.refresh_from_db()
        self.assertEqual(self.user1.profile.pinned_post_id, post2.id)

    def test_post_drafts(self):
        self.client.force_authenticate(user=self.user1)
        # Create draft
        draft_resp = self.client.post('/api/posts/drafts/', {
            'content': 'Draft post about #react and design',
            'location': 'New York',
            'feeling': 'inspired'
        })
        self.assertEqual(draft_resp.status_code, status.HTTP_201_CREATED)
        draft_id = draft_resp.data['id']

        # List drafts
        draft_list = self.client.get('/api/posts/drafts/')
        self.assertEqual(len(draft_list.data), 1)
        self.assertEqual(draft_list.data[0]['feeling'], 'inspired')

        # Delete draft
        del_resp = self.client.delete(f'/api/posts/drafts/{draft_id}/')
        self.assertEqual(del_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(PostDraft.objects.filter(id=draft_id).count(), 0)

    def test_bookmark_collections(self):
        post = Post.objects.create(author=self.user2, content="Awesome graphic design")
        self.client.force_authenticate(user=self.user1)

        # Create collection
        coll_resp = self.client.post('/api/bookmarks/collections/', {
            'name': 'Design Inspiration',
            'description': 'Saved design ideas'
        })
        self.assertEqual(coll_resp.status_code, status.HTTP_201_CREATED)
        coll_id = coll_resp.data['id']

        # Add post to collection
        item_resp = self.client.post(f'/api/bookmarks/collections/{coll_id}/items/', {
            'post_id': post.id
        })
        self.assertEqual(item_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(item_resp.data['in_collection'])
        self.assertEqual(item_resp.data['item_count'], 1)

    def test_comment_likes(self):
        post = Post.objects.create(author=self.user1, content="Discussion starter")
        comment = Comment.objects.create(post=post, author=self.user2, content="Spot on!")

        self.client.force_authenticate(user=self.user1)
        # Alice likes Bob's comment
        like_resp = self.client.post(f'/api/comments/{comment.id}/like/')
        self.assertEqual(like_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(like_resp.data['is_liked'])
        self.assertEqual(like_resp.data['like_count'], 1)

    def test_admin_panel_endpoints(self):
        # Create Staff Admin
        admin_user = User.objects.create_superuser(
            username='admin_boss',
            email='admin@example.com',
            password='Password123!'
        )
        self.client.force_authenticate(user=admin_user)

        # Admin fetches live stats
        stats_resp = self.client.get('/api/admin-panel/stats/')
        self.assertEqual(stats_resp.status_code, status.HTTP_200_OK)
        self.assertIn('total_users', stats_resp.data)
        self.assertIn('total_posts', stats_resp.data)

        # Regular user reports a post
        post = Post.objects.create(author=self.user2, content="Controversial content")
        self.client.force_authenticate(user=self.user1)
        report_resp = self.client.post('/api/social/report/', {
            'post': post.id,
            'reason': 'spam',
            'details': 'Repeated promotional spam'
        })
        self.assertEqual(report_resp.status_code, status.HTTP_201_CREATED)

        # Admin views reports queue
        self.client.force_authenticate(user=admin_user)
        reports_resp = self.client.get('/api/admin-panel/reports/')
        self.assertEqual(reports_resp.status_code, status.HTTP_200_OK)
        reports_list = reports_resp.data.get('results', reports_resp.data)
        self.assertTrue(len(reports_list) >= 1)
        report_id = reports_list[0]['id']

        # Admin resolves report
        resolve_resp = self.client.post(f'/api/admin-panel/reports/{report_id}/resolve/', {
            'status': 'resolved'
        })
        self.assertEqual(resolve_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resolve_resp.data['status'], 'resolved')

        # Admin suspends / bans user2
        ban_resp = self.client.post(f'/api/admin-panel/users/{self.user2.username}/ban/')
        self.assertEqual(ban_resp.status_code, status.HTTP_200_OK)
        self.assertTrue(ban_resp.data['is_deactivated'])

        # Admin unbans user2
        unban_resp = self.client.post(f'/api/admin-panel/users/{self.user2.username}/ban/')
        self.assertEqual(unban_resp.status_code, status.HTTP_200_OK)
        self.assertFalse(unban_resp.data['is_deactivated'])

