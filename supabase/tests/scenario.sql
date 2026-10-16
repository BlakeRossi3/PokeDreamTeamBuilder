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
-- friend battles: rules checked, only friends, only the two players, results both must confirm, 3 paid wins a day
set request.jwt.claim.sub = :'A';
select invite_battle(:'B', '{"format":4,"bag":true}')->>'status' as bad_rules;      -- bad_rules
select invite_battle(:'C', '{"format":3,"bag":true}')->>'status' as a_to_c;         -- not_friends
select invite_battle(:'B', '{"format":3,"bag":false}')->>'match_id' as mid \gset
set request.jwt.claim.sub = :'C';
select count(*) as c_sees_invites from battle_invites;                               -- 0
select respond_battle(:'mid', true)->>'status' as c_responds;                        -- not_found
set request.jwt.claim.sub = :'B';
select username, rules from battle_inbox();                                          -- Blake_1 | {"bag": false, "format": 3}
select respond_battle(:'mid', true)->>'status' as b_accepts;                         -- accepted
select report_battle(:'mid', 0, :'B', 12)->>'status' as b_reports;                  -- waiting
set request.jwt.claim.sub = :'A';
select report_battle(:'mid', 0, :'A', 12)->>'status' as a_disagrees;                -- mismatch
select count(*) filter (where report_battle(:'mid', r, :'B', 9)->>'status' = 'waiting') as a_reports_4 from generate_series(1, 4) r;   -- 4
set request.jwt.claim.sub = :'B';
select r as round, report_battle(:'mid', r, :'B', 9)->>'paid' as paid from generate_series(1, 4) r;   -- true true true false
select battle_record();                                                              -- {"wins": 4, "losses": 0}
insert into battle_results values (:'mid', 9, :'B', :'A', 1, true);                 -- direct writes blocked
set request.jwt.claim.sub = :'A';
select invite_battle(:'B', '{"format":1,"bag":true}')->>'match_id' as mid2 \gset
reset role; update battle_invites set created_at = now() - interval '3 minutes' where match_id = :'mid2'; set role authenticated;
set request.jwt.claim.sub = :'B';
select respond_battle(:'mid2', true)->>'status' as late;                            -- expired
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
