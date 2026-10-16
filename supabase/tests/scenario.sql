-- What each player can and can't do, run as three pretend players (A, B, C). Expected results are in the comments.
\set ON_ERROR_STOP 0
\set A '00000000-0000-0000-0000-00000000000a'
\set B '00000000-0000-0000-0000-00000000000b'
\set C '00000000-0000-0000-0000-00000000000c'
set role authenticated;
-- A
set request.jwt.claim.sub = :'A';
select username, length(friend_code) from claim_username('Blake_1');
select claim_username('Fuckface');            -- error username_not_allowed
select claim_username('Blake_2');             -- rate limited
select put_save('{"v":7}'::jsonb, 0, 'laptop');
select put_save('{"v":7,"x":1}'::jsonb, 1, 'laptop');
select put_save('{"v":7,"x":2}'::jsonb, 1, 'phone');   -- conflict -> ok false version 2
select count(*) as versions from save_versions;
select put_save(jsonb_build_object('big', repeat('x', 1100000)), 2, 'x');   -- size cap error
-- B
set request.jwt.claim.sub = :'B';
select username from claim_username('blake_1');   -- taken (case-insensitive)
select username from claim_username('Misty');
select count(*) as b_sees_saves from saves;      -- 0
select count(*) as b_sees_profiles from profiles; -- 1 (self)
select add_friend('Blake_1');
select count(*) as b_sees_profiles_after from profiles; -- 2
insert into public_profile (user_id, card) values (:'B', '{"name":"Misty"}');
-- A accepts
set request.jwt.claim.sub = :'A';
select user_id = :'B' as is_b, username, status, outgoing from friend_list();
select respond_friend(:'B', true);
select username, status from friend_list();
insert into public_profile (user_id, card) values (:'A', '{"name":"Blake"}');
select card from public_profile order by updated_at;   -- A sees both
select like_home(:'B'); select like_home(:'B');           -- liked, already_liked
insert into friendships values (:'A', :'C', 'accepted');  -- direct writes blocked
update profiles set username = 'hacker' where id = :'A';  -- column privilege error
-- C (not a friend)
set request.jwt.claim.sub = :'C';
select username from claim_username('Brock');
select count(*) as c_sees_public from public_profile;   -- 0
select like_home(:'A');                                 -- not_friends
-- B collects likes, then blocks A
set request.jwt.claim.sub = :'B';
select * from likes_received(null);
select block_user(:'A');
set request.jwt.claim.sub = :'A';
select count(*) as a_sees_b_profile from profiles where id = :'B';   -- 0
select add_friend('Misty');                                          -- not_found
select count(*) as a_sees_b_public from public_profile where user_id = :'B';  -- 0
select jsonb_typeof(my_data());
-- delete account
select delete_my_account();
reset role;
select count(*) as a_rows_left from profiles where id = :'A';
select count(*) from saves; select count(*) from save_versions;
set role anon; select count(*) from profiles; reset role;
