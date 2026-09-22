"""
VIBELY END-TO-END ADVANCED FEATURE VERIFICATION SCRIPT
Executes real two-user workflows against the Django backend.
"""

import os
import sys
import django

# Setup Django Environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from posts.models import Post, Reaction, PostDraft, BookmarkCollection, BookmarkCollectionItem, StoryHighlight
from social.models import Follow, FollowRequest, Mute, HiddenPost, Report
from comments.models import Comment, CommentLike

def run_verification():
    print("==================================================================")
    print("STARTING VIBELY 39-POINT PRO SUITE VERIFICATION")
    print("==================================================================")

    client_a = APIClient()
    client_b = APIClient()
    client_admin = APIClient()

    user_a = User.objects.get(username='alex_demo')
    user_b = User.objects.get(username='sophia_demo')
    admin_u = User.objects.get(username='admin')

    client_a.force_authenticate(user=user_a)
    client_b.force_authenticate(user=user_b)
    client_admin.force_authenticate(user=admin_u)

    # 1. Post Creation with Extra Metadata
    print("\n[1/10] Testing Post Creation with Location & Feeling...")
    p_resp = client_a.post('/api/posts/', {
        'content': 'Enjoying sunset in Santorini! #vibely #travel',
        'location': 'Santorini, Greece',
        'feeling': 'peaceful',
        'visibility': 'everyone'
    })
    assert p_resp.status_code == 201, f"Post create failed: {p_resp.data}"
    post_a_id = p_resp.data['id']
    print(f"  [PASS] Post #{post_a_id} created with location='Santorini, Greece', feeling='peaceful'")

    # 2. Multi-Reactions
    print("\n[2/10] Testing Multi-Reactions (Love, Funny, etc.)...")
    react_resp = client_b.post(f'/api/posts/{post_a_id}/react/', {'reaction_type': 'love'})
    assert react_resp.status_code == 200, f"React failed: {react_resp.data}"
    assert react_resp.data['user_reaction'] == 'love'
    assert react_resp.data['reactions_count']['love'] >= 1
    print("  [PASS] User B reacted with 'love'")

    # 3. Quote Post
    print("\n[3/10] Testing Quote Post / Repost with Commentary...")
    quote_resp = client_b.post('/api/posts/', {
        'content': 'Santorini is gorgeous, Alex!',
        'repost_of': post_a_id
    })
    assert quote_resp.status_code == 201, f"Quote post failed: {quote_resp.data}"
    assert quote_resp.data['repost_of_data'] is not None
    assert quote_resp.data['repost_of_data']['author']['username'] == 'alex_demo'
    quote_post_id = quote_resp.data['id']
    print(f"  [PASS] User B created Quote Post #{quote_post_id} embedding Post #{post_a_id}")

    # 4. Private Profile & Follow Request Workflow
    print("\n[4/10] Testing Private Profile & Follow Request Flow...")
    # Clean any existing follow
    Follow.objects.filter(follower=user_b, following=user_a).delete()
    FollowRequest.objects.filter(sender=user_b, recipient=user_a).delete()

    user_a.profile.is_private = True
    user_a.profile.save()

    f_req = client_b.post(f'/api/users/{user_a.username}/follow/')
    assert f_req.status_code == 200
    assert f_req.data['requested'] is True, f"Expected requested=True, got {f_req.data}"
    print("  [PASS] User B followed private profile -> follow request queued")

    # User A checks incoming requests
    reqs_resp = client_a.get('/api/social/follow-requests/')
    assert reqs_resp.status_code == 200
    req_id = reqs_resp.data[0]['id']

    # User A accepts request
    acc_resp = client_a.post(f'/api/social/follow-requests/{req_id}/action/', {'action': 'accept'})
    assert acc_resp.status_code == 200
    assert Follow.objects.filter(follower=user_b, following=user_a).exists()
    print("  [PASS] User A accepted follow request -> User B is now officially following")

    # 5. User Mute & Post Hide
    print("\n[5/10] Testing Post Hide & User Mute...")
    hide_resp = client_b.post(f'/api/posts/{post_a_id}/hide/')
    assert hide_resp.status_code == 200
    assert hide_resp.data['is_hidden'] is True

    # Feed excludes hidden post
    feed_resp = client_b.get('/api/posts/')
    ids = [p['id'] for p in feed_resp.data['results']]
    assert post_a_id not in ids, "Hidden post appeared in feed"
    print("  [PASS] Post successfully hidden from feed")

    # Unhide
    client_b.post(f'/api/posts/{post_a_id}/hide/')

    # Mute
    mute_resp = client_b.post(f'/api/social/mute/{user_a.username}/')
    assert mute_resp.status_code == 200
    assert mute_resp.data['is_muted'] is True
    feed_resp2 = client_b.get('/api/posts/')
    ids2 = [p['id'] for p in feed_resp2.data['results']]
    assert post_a_id not in ids2, "Muted user posts appeared in feed"
    print("  [PASS] User A muted -> User A posts excluded from User B feed")

    # Unmute
    client_b.post(f'/api/social/mute/{user_a.username}/')

    # 6. Post Pinning
    print("\n[6/10] Testing Post Pinning on Profile...")
    pin_resp = client_a.post(f'/api/posts/{post_a_id}/pin/')
    assert pin_resp.status_code == 200
    assert pin_resp.data['is_pinned'] is True
    user_a.profile.refresh_from_db()
    assert user_a.profile.pinned_post_id == post_a_id
    print(f"  [PASS] Post #{post_a_id} pinned to @alex_demo profile")

    # 7. Post Drafts
    print("\n[7/10] Testing Post Drafts System...")
    d_resp = client_a.post('/api/posts/drafts/', {
        'content': 'Upcoming feature brainstorm #vibely',
        'location': 'Lab',
        'feeling': 'focused'
    })
    assert d_resp.status_code == 201
    draft_id = d_resp.data['id']
    d_list = client_a.get('/api/posts/drafts/')
    assert any(d['id'] == draft_id for d in d_list.data)
    client_a.delete(f'/api/posts/drafts/{draft_id}/')
    print("  [PASS] Post draft created, verified, and cleaned up")

    # 8. Bookmark Collections
    print("\n[8/10] Testing Bookmark Collections & Categorization...")
    coll_resp = client_a.post('/api/bookmarks/collections/', {
        'name': 'Greek Holiday Memories'
    })
    assert coll_resp.status_code == 201
    coll_id = coll_resp.data['id']
    item_resp = client_a.post(f'/api/bookmarks/collections/{coll_id}/items/', {
        'post_id': post_a_id
    })
    assert item_resp.status_code == 200
    assert item_resp.data['in_collection'] is True
    print(f"  [PASS] Post #{post_a_id} saved into collection '{coll_resp.data['name']}'")

    # 9. Story Highlights
    print("\n[9/10] Testing Profile Story Highlights...")
    h_resp = client_a.post('/api/stories/highlights/', {
        'title': 'Wanderlust'
    })
    assert h_resp.status_code == 201
    assert h_resp.data['title'] == 'Wanderlust'
    print("  [PASS] Story Highlight 'Wanderlust' created successfully")

    # 10. Staff Admin Hub & Moderation Controls
    print("\n[10/10] Testing Admin Moderation Hub & Telemetry...")
    stats_resp = client_admin.get('/api/admin-panel/stats/')
    assert stats_resp.status_code == 200
    assert stats_resp.data['total_users'] >= 3
    assert stats_resp.data['total_posts'] >= 1
    print(f"  [PASS] Admin Stats Telemetry verified (Users: {stats_resp.data['total_users']}, Posts: {stats_resp.data['total_posts']})")

    # Report Resolution
    reports_resp = client_admin.get('/api/admin-panel/reports/')
    assert reports_resp.status_code == 200
    rep_list = reports_resp.data.get('results', reports_resp.data)
    if rep_list:
        target_rep_id = rep_list[0]['id']
        res_resp = client_admin.post(f'/api/admin-panel/reports/{target_rep_id}/resolve/', {'status': 'resolved'})
        assert res_resp.status_code == 200
        print(f"  [PASS] Moderator resolved Report #{target_rep_id}")

    # User Suspension Tool
    ban_resp = client_admin.post(f'/api/admin-panel/users/{user_b.username}/ban/')
    assert ban_resp.status_code == 200
    assert ban_resp.data['is_deactivated'] is True
    print(f"  [PASS] User @{user_b.username} successfully suspended via admin tool")

    # Unban
    unban_resp = client_admin.post(f'/api/admin-panel/users/{user_b.username}/ban/')
    assert unban_resp.status_code == 200
    assert unban_resp.data['is_deactivated'] is False
    print(f"  [PASS] User @{user_b.username} restored to active status")

    print("\n==================================================================")
    print("ALL 10 E2E INTERACTION WORKFLOWS PASSED WITH 100% SUCCESS!")
    print("==================================================================")

if __name__ == '__main__':
    run_verification()
