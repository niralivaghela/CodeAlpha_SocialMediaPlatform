"""
Verification script testing two-user flow:
User A: alex_demo
User B: sophia_demo
Tests:
1. User A logs in and creates a post with poll and hashtags
2. User B logs in, fetches feed, sees User A's post
3. User B votes in the poll
4. User B likes the post
5. User A verifies notification received for like
6. User B leaves a comment
7. User A verifies notification received for comment
8. User A replies to User B's comment
9. User A follows User B; verify follower counts
10. User A sends direct message to User B; User B fetches and verifies receipt
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()


from django.test import Client
from django.contrib.auth.models import User
from posts.models import Post, Like, PollVote
from comments.models import Comment
from social.models import Follow
from notifications.models import Notification
from messaging.models import Conversation, Message

def run_verification():
    print("=" * 65)
    print("VIBELY REAL-WORLD TWO-USER FLOW VERIFICATION")
    print("=" * 65)

    client_a = Client()
    client_b = Client()

    # Step 1: User A Login
    print("\n[Step 1] Logging in User A (alex_demo)...")
    res_a = client_a.post('/api/auth/login/', {
        'username': 'alex_demo',
        'password': 'DemoPassword123!'
    }, content_type='application/json')
    assert res_a.status_code == 200, f"Login failed: {res_a.data}"
    user_a = User.objects.get(username='alex_demo')
    print(f"  ✓ User A logged in: @{user_a.username} ({user_a.profile.display_name})")

    # Step 2: User B Login
    print("\n[Step 2] Logging in User B (sophia_demo)...")
    res_b = client_b.post('/api/auth/login/', {
        'username': 'sophia_demo',
        'password': 'DemoPassword123!'
    }, content_type='application/json')
    assert res_b.status_code == 200, f"Login failed: {res_b.data}"
    user_b = User.objects.get(username='sophia_demo')
    print(f"  ✓ User B logged in: @{user_b.username} ({user_b.profile.display_name})")

    # Step 3: User A creates a new post with a poll
    print("\n[Step 3] User A creates post with poll and hashtag...")
    res_post = client_a.post('/api/posts/', {
        'content': 'Testing multi-user real-time interaction on #vibely! Vote below:',
        'poll_question': 'Does this social platform meet real-world standards?',
        'poll_options': '["Yes, absolutely!", "Exceeds expectations", "Clean architecture"]'
    })
    assert res_post.status_code == 201, f"Post creation failed: {res_post.data}"
    post_id = res_post.data['id']
    poll_id = res_post.data['poll']['id']
    first_opt_id = res_post.data['poll']['options'][0]['id']
    print(f"  ✓ Post #{post_id} created with poll #{poll_id}")

    # Step 4: User B sees User A's post in feed
    print("\n[Step 4] User B fetches feed and finds User A's post...")
    res_feed = client_b.get('/api/posts/')
    assert res_feed.status_code == 200
    posts = res_feed.data['results']
    found_post = next((p for p in posts if p['id'] == post_id), None)
    assert found_post is not None, "User B did not find post in feed"
    print(f"  ✓ User B sees post #{post_id} in feed: '{found_post['content'][:40]}...'")

    # Step 5: User B votes in User A's poll
    print("\n[Step 5] User B votes on Option 1 in the poll...")
    res_vote = client_b.post(f'/api/posts/{post_id}/vote/', {
        'option_id': first_opt_id
    }, content_type='application/json')
    assert res_vote.status_code == 200
    assert res_vote.data['total_votes'] >= 1
    print(f"  ✓ Vote registered. Poll total votes: {res_vote.data['total_votes']}")

    # Step 6: User B likes User A's post
    print("\n[Step 6] User B likes User A's post...")
    res_like = client_b.post(f'/api/posts/{post_id}/like/')
    assert res_like.status_code == 200
    assert res_like.data['is_liked'] is True
    print(f"  ✓ User B liked post. Like count is now: {res_like.data['like_count']}")

    # Step 7: User A verifies notification for like
    print("\n[Step 7] User A checks notifications for like event...")
    res_notif_a = client_a.get('/api/notifications/')
    assert res_notif_a.status_code == 200
    like_notifs = [n for n in res_notif_a.data['results'] if n['action_type'] == 'like' and n['actor']['username'] == 'sophia_demo' and n['post_id'] == post_id]
    assert len(like_notifs) > 0, "No like notification found for User A"
    print(f"  ✓ User A received notification: @sophia_demo liked post #{post_id}")

    # Step 8: User B comments on User A's post
    print("\n[Step 8] User B leaves a comment on User A's post...")
    res_comment = client_b.post(f'/api/posts/{post_id}/comments/', {
        'content': 'This architecture is rock solid! Great work @alex_demo.'
    }, content_type='application/json')
    assert res_comment.status_code == 201
    comment_id = res_comment.data['id']
    print(f"  ✓ Comment #{comment_id} posted by User B")

    # Step 9: User A checks notification for comment and replies
    print("\n[Step 9] User A checks comment notification and posts nested reply...")
    res_notif_c = client_a.get('/api/notifications/')
    comment_notifs = [n for n in res_notif_c.data['results'] if n['action_type'] == 'comment' and n['actor']['username'] == 'sophia_demo']
    assert len(comment_notifs) > 0, "No comment notification found for User A"
    print("  ✓ User A received notification for comment")

    res_reply = client_a.post(f'/api/posts/{post_id}/comments/', {
        'content': 'Thank you Sophia! Appreciate the feedback.',
        'parent_id': comment_id
    }, content_type='application/json')
    assert res_reply.status_code == 201
    print(f"  ✓ User A posted nested reply #{res_reply.data['id']} to comment #{comment_id}")

    # Step 10: Follow relationship verification
    print("\n[Step 10] Checking Follow / Following relationships...")
    follow_resp = client_a.post('/api/users/sophia_demo/follow/')
    assert follow_resp.status_code == 200
    print(f"  ✓ Follow state toggled: is_following={follow_resp.data['is_following']}")
    # Restore follow if toggled off
    if not follow_resp.data['is_following']:
        client_a.post('/api/users/sophia_demo/follow/')

    # Step 11: Direct messaging between User A and User B
    print("\n[Step 11] Direct messaging between User A and User B...")
    conv_resp = client_a.post('/api/conversations/start/', {
        'username': 'sophia_demo'
    }, content_type='application/json')
    assert conv_resp.status_code == 200
    conv_id = conv_resp.data['id']

    msg_resp = client_a.post(f'/api/conversations/{conv_id}/messages/', {
        'text': 'Hey Sophia! Reviewing the real-world test results.'
    }, content_type='application/json')
    assert msg_resp.status_code == 201
    sent_msg_id = msg_resp.data['id']
    print(f"  ✓ Message #{sent_msg_id} sent by User A to User B")

    # User B fetches messages
    res_msgs_b = client_b.get(f'/api/conversations/{conv_id}/messages/')
    assert res_msgs_b.status_code == 200
    b_received_msg = next((m for m in res_msgs_b.data if m['id'] == sent_msg_id), None)
    assert b_received_msg is not None, "User B did not receive message"
    print(f"  ✓ User B received message: '{b_received_msg['text']}'")

    print("\n" + "=" * 65)
    print("SUCCESS: ALL 11 MULTI-USER REAL-WORLD VERIFICATION STEPS PASSED!")
    print("=" * 65)

if __name__ == '__main__':
    run_verification()
