# Weekly Student Question Feature Implementation Plan

## Document Status

| Item | Decision |
| --- | --- |
| Feature working name | Weekly Question |
| Product audience | Haki college-student users |
| Relationship to existing features | New online community feature; separate from Tips & Tricks and separate from Haki chat/retrieval |
| Recommended backend | Supabase Free Plan for v1 |
| Student identity model | Anonymous Supabase Auth sessions; no visible sign-in/sign-up experience |
| Administrator workflow for v1 | Supabase Dashboard moderation and scheduling; no in-app admin publishing |
| Question modes | Moderated free-text sharing and structured multiple-choice poll |
| Publication model | Text mode shows two approved answers per display day for six days; poll mode shows aggregate percentage results on Home during the six display days |
| Content deletion policy | Purge answer text and individual poll votes after the final display period, except text content under an unresolved moderation hold |
| Source verification date | May 26, 2026 |

## 1. Executive Summary

Weekly Question is a new online-only social feature in which an administrator posts one simple weekly prompt and students respond anonymously. It supports two question modes:

| Mode | Student Response | Public Result |
| --- | --- | --- |
| `open_text` | A short written answer | After one submission day, selected moderated answers are displayed at two scheduled times per day for six display days |
| `multiple_choice_poll` | One administrator-defined choice | After voting closes, all valid votes are aggregated into percentages and presented as a visual graph on the Haki Home screen during the six display days |

Example prompts:

- Open text: "What is the best advice given to you by someone?"
- Multiple-choice poll: "Which do you like more?" with choices `Cat`, `Dog`, and `Other`.

This feature is feasible in the current Haki project because it can be added as an independent online module without changing the local AI system, official campus retrieval behavior, or offline availability of existing features.

The implementation must treat student answers as user-generated content (UGC), even when questions are casual and expected responses are harmless. Students can type text that contains harassment, personal information, offensive material, or misinformation regardless of the question. For that reason:

- Raw text submissions and individual poll votes must never be shown publicly.
- Random display may operate only on administrator-approved answers.
- Reporting, removal, and abusive-user blocking controls are required.
- Student answers must never become Haki knowledge sources or official campus answers.

Multiple-choice polls substantially reduce content-moderation exposure because students do not type public content; they choose among options written by the administrator. Poll results still require privacy safeguards: individual votes must remain private, and the graph must not be published when too few students participated.

The recommended v1 implementation uses Supabase because the feature is naturally relational: one cycle has one question, text submissions or poll votes, moderation decisions or aggregate results, publication slots, and optional reports. Supabase offers official Expo React Native integration, anonymous authentication, Row Level Security (RLS), dashboard-based moderation, and documented scheduling support through Supabase Cron.

## 2. Goals And Non-Goals

### 2.1 Goals

The implementation must:

1. Provide a distinct Weekly Question experience for Haki users.
2. Allow students to participate without creating visible accounts or submitting identity fields.
3. Support either a moderated short-text question or a structured multiple-choice poll for each cycle.
4. Accept one response from an anonymous app user per weekly question.
5. Hold all free-text submissions for moderation before they can be displayed.
6. Support administrator manual selection or random selection from approved free-text content only.
7. Display two text answers per day for six days, for up to twelve displayed answers per open-text cycle.
8. Aggregate poll votes into percentages and show a visual Home screen result card for qualifying multiple-choice cycles.
9. Keep publication scheduling consistent in Philippine time.
10. Provide controls to report published text content and report an inappropriate administrator-created prompt or poll.
11. Purge student answer text and individual poll votes after each completed weekly display cycle, subject to unresolved text-report holds.
12. Operate without affecting Haki's offline assistant behavior or authoritative campus-content rules.

### 2.2 Non-Goals For Version One

Version one must not include:

- Replies, comments, reactions, likes, follower features, direct messages, or student profiles.
- Student images, attachments, hyperlinks, audio, video, or rich media.
- Student-entered text attached to a multiple-choice poll, including typed "Other" responses.
- Public browsing of past answers or an archive of old cycles.
- Verification that a participant is an enrolled TUP student.
- Push notifications announcing newly displayed answers.
- An in-app administrator dashboard protected only by Haki's existing local admin PIN.
- Use of submitted answers in chat retrieval, AI prompting, official answers, recommendations, or student profiling.
- Automatic publication of unreviewed student input.

## 3. Project Fit And Isolation Requirements

### 3.1 Current Project Facts

Relevant existing project facts:

- Haki is an Expo/React Native app with routes in `app/`.
- `app.json` currently declares `offlineMvp: true`.
- The user tab bar currently includes Home, Map, Chat, Library, and Tips in `app/_layout.tsx`.
- The current `Tips` screen consumes static `src/data/studentTips.ts` content and is not a time-bound weekly discussion system.
- Project documentation states that display-only datasets must not be represented as official source evidence.
- Current administrator mode is enabled locally using an admin-code hash and `AsyncStorage` in `src/services/adminService.ts`.

### 3.2 Feature Boundary

Weekly Question must be implemented as a separate feature domain:

| Domain | Ownership |
| --- | --- |
| Weekly prompts, text submissions, poll votes, aggregate poll results, moderation, scheduled displays, reports | New remote Weekly Question module |
| Existing Tips & Tricks cards | Existing local tips feature; unchanged |
| Official campus documents and retrieval | Existing local source data; unchanged |
| Haki chat, local model and answer orchestration | Existing AI services; unchanged |
| Local admin unlock | Existing local-only behavior; not trusted for remote publishing |

### 3.3 Required Separation From Official Answers

No Weekly Question data may be:

- inserted into `src/data/seed-documents.json`;
- indexed into local retrieval tables;
- attached as source context in `src/services/answerService.ts`;
- described to students as verified university information;
- used to answer campus procedural questions.

The Weekly Question screen must visually label displayed text content as anonymous student responses, not university guidance. The Home screen graph must label percentages as anonymous student poll results, not campus statistics or an official university survey.

## 4. Product Experience

### 4.1 Navigation Placement

Version one should introduce a new route rather than combining the feature with Tips & Tricks.

Recommended entry model:

- Create a dedicated Weekly Question screen reachable from a card or action on Home for submission, response display and full poll-result context.
- For a published `multiple_choice_poll` cycle, add a compact graph card directly to the Home dashboard showing the aggregate percentages and linking to Weekly Question.
- Keep the existing five primary tabs unchanged for v1 to avoid overcrowding the bottom navigation.
- A future product decision may promote Weekly Question to a tab if engagement justifies it.

Recommended user-facing feature name:

- Screen title: `Weekly Question`
- Supporting label: `Anonymous student responses`

### 4.2 Weekly Cycle

Each weekly cycle has exactly one question mode selected before publication: `open_text` or `multiple_choice_poll`. The mode cannot change after submissions open.

Each weekly cycle consists of one response period and six display days:

| Stage | Duration | Open-Text Student Experience | Poll Student Experience | Admin Experience |
| --- | --- | --- | --- | --- |
| Draft | Before publishing | No new question shown | No new poll shown | Admin creates prompt, mode, dates and any options |
| Submission open | One full day | Students see the prompt and submit text once | Students select one administrator-defined option once; results are hidden while voting is open | Admin may observe response count only |
| Review and scheduling | After close, before first display period | Submissions closed; display start message shown | Votes closed; aggregate result is generated if the minimum response threshold is reached | Admin approves/rejects text and schedules answers, or confirms the poll-result display |
| Display active | Six days | Students see the current displayed answer in Weekly Question | Students see the aggregate graph on Home and in Weekly Question | Admin handles reports/removal |
| Cycle closed | After final display period | No prior answer content exposed | Graph is no longer public | Purge runs, subject to text-report holds |

### 4.3 Default Calendar Template

The implementation must not hardcode a weekday, because an administrator may need to skip holidays or adjust a cycle. Instead, each question stores its own opening, closing, and display dates.

The administrative default template is:

| Day | Phase |
| --- | --- |
| Monday, 12:00 AM to 11:59 PM Asia/Manila | Text submissions or poll voting open |
| Tuesday through Sunday | Six display days |

The administrator may choose a different start date before publishing the question. Once submissions open, the schedule must not be edited in a way that shortens already communicated participation or display periods.

### 4.4 Display Slots

For an `open_text` cycle, each display day has two answer slots:

| Slot | Local Display Period |
| --- | --- |
| Morning slot | 9:00 AM through 12:59:59 PM Asia/Manila |
| Afternoon slot | 1:00 PM through 4:59:59 PM Asia/Manila |

Outside those periods, the feature displays the weekly question and an appropriate status, but does not expose a scheduled answer unless the product later explicitly adds an overnight persistence behavior.

For a `multiple_choice_poll` cycle:

- There are no individual-answer slots.
- The aggregate result graph is public on Home and the Weekly Question screen throughout the six display days.
- Public poll results are generated only after voting closes, so early results do not influence later responses.
- The graph is removed from public access after the sixth display day ends.

Technical time rule:

- User-facing scheduling is interpreted in `Asia/Manila`.
- Persist schedule timestamps as UTC `timestamptz` values.
- For text cycles, calculate the twelve slots when a cycle is scheduled; for poll cycles, calculate one six-day graph visibility period. Do not calculate publication windows differently on individual clients.

### 4.5 Insufficient Approved Answers For Open-Text Questions

A normal full cycle requires twelve approved answers. A cycle may receive fewer than twelve safe answers.

Version one behavior is:

- Do not publish rejected or unreviewed answers to fill missing slots.
- Do not repeat the same answer automatically.
- Any unscheduled slot displays: `No student response is scheduled for this time.`
- The admin may manually reuse an approved answer only if intentionally scheduled more than once before the display period starts.

This prioritizes trust and predictable moderation over artificially filling all slots.

### 4.6 Poll Options And Percentage Results

A `multiple_choice_poll` is a structured-response question, not a free-text response question.

Rules for options:

- The administrator supplies between two and six options before publishing the cycle.
- Each option label is plain text, limited to 40 characters, and reviewed together with the prompt.
- If an `Other` choice is appropriate, it is an administrator-defined selectable option only; v1 does not permit a student to type an explanation.
- Options become immutable once voting opens.
- Each anonymous identity may select exactly one option for the cycle.

Public percentage-result rules:

- Keep individual votes private at all times.
- Do not expose live totals while voting is open.
- Publish a graph only when at least five valid votes were received; this is a v1 privacy safeguard to avoid disclosing a very small group's individual preferences.
- If fewer than five valid votes are received, display `Not enough responses to show results this week.` rather than a graph.
- Generate counts and graph percentages on the backend after the voting window closes.
- Display each option with its label, percentage and a proportional visual bar.
- Show the total number of valid responses with the graph, since the context of a percentage matters.

Percentage calculation:

1. Count valid votes for each option.
2. Divide each option count by total valid votes.
3. Convert results to whole-number display percentages using the largest-remainder method so visible percentages add to exactly 100%.
4. Preserve server-generated counts and percentage values for the six-day public display period; the mobile app must not recompute them from raw votes.

## 5. Selection Modes

### 5.1 Supported Modes

Selection modes apply only when `question_mode = open_text`. Each open-text cycle has one selection mode:

| Mode | Description | Required Control |
| --- | --- | --- |
| `manual` | Administrator assigns an approved answer to each slot | Only approved submissions can be assigned |
| `random_approved` | System assigns distinct approved answers to vacant slots using random order | Administrator first approves candidates, then initiates assignment |

### 5.2 Manual Mode

Manual mode is the recommended first operational mode because it provides the greatest oversight and the least surprising behavior.

Workflow:

1. Administrator reviews each pending answer.
2. Administrator marks appropriate responses as approved.
3. Administrator selects up to twelve approved answers.
4. Administrator assigns selected answers to particular display slots.
5. Administrator confirms the schedule before display begins.

### 5.3 Random-Approved Mode

Random-approved mode must never include pending or rejected content.

Workflow:

1. Administrator reviews every candidate intended for public display.
2. Administrator explicitly marks safe candidates as approved.
3. Administrator invokes an administrative scheduling action.
4. The database selects up to twelve distinct approved submissions in random order.
5. The chosen answers are assigned to empty publication slots.
6. Administrator reviews the completed schedule and may remove or replace any slot before it begins.

The randomness is for content variety only; it is not used to make a decision about a student or award any benefit. No specialized fairness algorithm is required in v1.

### 5.4 Multiple-Choice Poll Publication

A `multiple_choice_poll` cycle does not use `manual` or `random_approved` answer selection because no individual response is published.

Workflow:

1. Administrator creates and reviews a prompt and two to six fixed options.
2. Students privately select one option during the response window.
3. After voting closes, the backend counts valid votes and applies the five-response publication threshold.
4. If eligible, the backend creates a fixed aggregate result snapshot for public display.
5. The Home screen graph and Weekly Question detail screen read only that snapshot during the six display days.
6. After the display period ends, individual votes and public result snapshot values are purged under the retention policy.

## 6. Safety, UGC And Privacy Requirements

### 6.1 Why Moderation Still Applies

Simple open-text prompts lower expected risk but do not eliminate risk. A participant can submit:

- identifying personal information;
- harassment or insults;
- discriminatory, violent or sexual content;
- spam or advertisements;
- accusations about real people;
- misleading claims presented as advice.

Open-text answers are UGC when they become visible to another user. Apple App Review Guideline 1.2 and the Google Play UGC policy therefore apply if the app is distributed through those stores.

For multiple-choice polls, students do not submit public text; the administrator controls every visible option label and only aggregate results are displayed. Poll prompts and options still require administrator review before publication, a reporting path for inappropriate visible material, and private treatment of individual votes.

### 6.2 Student Response Policy

Before the first response to a question, the student must accept a concise participation and privacy notice. Acceptance is recorded per anonymous session and policy version.

Required points for all modes:

- Participation is anonymous in the interface, but an internal anonymous account identifier is used to limit duplicate participation and respond to abuse.
- Submitted data is used only for operating the Weekly Question feature, moderation where applicable and temporary public presentation.
- Data is deleted after the completed display cycle except where temporarily retained to resolve a report or safety issue.

Additional points for open-text mode:

- Written responses may be displayed anonymously to other students if selected.
- Do not submit your name, student number, class/section, contact details, account handle, or location.
- Do not identify, accuse, insult, threaten, or reveal information about another person.
- Do not submit sexual, violent, discriminatory, illegal, or promotional content.
- Answers are moderated and may be rejected, removed, or reported.
- Haki may block abusive anonymous participation.

Additional points for poll mode:

- The selected option is counted privately and displayed only as part of an aggregate percentage result when enough students participate.
- Individual selections are not shown to students or tied to a public identity.

### 6.3 Prompt Safety Rules

Administrators must select prompts that solicit low-risk general opinions or experiences.

Allowed prompt characteristics:

- preference questions;
- general reflection questions;
- positive college-life or hobby discussion;
- no need to name people, courses, instructors, offices, or incidents.

Additional multiple-choice prompt rules:

- Every visible choice is authored or selected by the administrator.
- Polls ask low-risk preferences or opinions, not protected, intimate or sensitive characteristics.
- `Other` may be included as a fixed option, but it must not open a free-text field in v1.

Prompts to avoid:

- requests to name a best or worst instructor, classmate, office, organization, or employee;
- prompts encouraging allegations or complaints about identifiable people;
- mental health, medical, financial hardship, disciplinary, relationship, or sexual-experience disclosures;
- political or religious confrontation questions;
- prompts inviting cheating, leaked exams, or academic dishonesty.

### 6.4 Reporting And Blocking

Displayed open-text answers must provide a report action while they are visible. A displayed poll graph must provide a report path for an inappropriate administrator-authored prompt or option; it does not report an individual student's vote.

A report record captures:

- the published slot and submission identifier;
- the reporting anonymous user identifier;
- a selected report category;
- report timestamp;
- status (`open`, `reviewed`, `actioned`, `dismissed`);
- optional short reporter note only if needed, with a strict length limit.

Suggested report categories:

- Personal information
- Bullying or harassment
- Offensive or sexual content
- Spam or advertising
- Other safety concern

For a poll graph report, capture the cycle identifier rather than a submission identifier, and provide categories appropriate to the prompt/options, such as inappropriate question, offensive choice label, or other concern.

Blocking policy:

- The administrator can block an abusive anonymous author ID from submitting future responses.
- A blocked identity cannot insert new submissions.
- Blocking is not guaranteed to stop a user who reinstalls the app, clears auth storage, or changes devices.
- Repeated evasion may require stronger controls in a later release.

### 6.5 Philippine Privacy Considerations

The feature minimizes identification by not requesting student account data, but the submitted text may itself contain personal information.

Under the Philippine Data Privacy Act of 2012:

- Personal information includes information that identifies an individual directly or when combined with other information.
- Personal information must be collected for declared and legitimate purposes and retained only as long as necessary.
- The controller remains accountable when using a third-party processor.

Implementation requirements:

- Provide a privacy notice before submission.
- For open-text cycles, collect only the answer text, anonymous technical identity, required moderation fields and operational timestamps.
- For poll cycles, collect only the selected option identifier, anonymous technical identity and operational timestamps; do not allow explanatory text.
- Expose poll choices publicly only as aggregate results meeting the minimum response threshold.
- Do not request student number, full name, email, profile, course, year level, or demographic information.
- Document the purpose: moderation and temporary anonymous public display of selected text responses or qualifying aggregate poll results.
- Provide moderation/contact information for privacy or removal requests.
- Delete content according to the retention policy in Section 12.

This plan identifies product and engineering safeguards; final institutional privacy review remains appropriate before a public production deployment.

## 7. Backend Selection

### 7.1 Recommendation: Supabase

Use Supabase for version one.

Reasons:

| Requirement | Supabase Capability |
| --- | --- |
| Expo mobile client integration | Official Expo React Native quickstart documents `@supabase/supabase-js` integration |
| No visible student accounts | Anonymous Sign-Ins provide an authenticated anonymous user |
| Restrict private submissions | PostgreSQL RLS controls row-level access |
| Structured moderation, votes and results | PostgreSQL tables naturally represent cycles, text submissions, private poll votes, aggregate result snapshots, reports and slots |
| Initial admin operations | Supabase Dashboard and SQL Editor avoid insecure app-side admin authority |
| Purge automation | Supabase Cron can schedule SQL/database-function jobs |
| Pilot free tier | Free Plan documentation lists two active free projects, 500 MB database per project, 50,000 MAU and 5 GB egress |

### 7.2 Firebase Alternative

Firebase remains technically feasible because Firebase Authentication supports anonymous users, Firestore Security Rules can restrict access, and Cloud Firestore documents a free quota.

Firebase is not selected for v1 because the workflow is relational and moderation-centered. Using Supabase avoids representing approval queues, slots, reports and deletion holds as a less natural document model. This is a project architecture choice, not a claim that Firebase cannot implement the feature.

## 8. Supabase Environment And Security Model

### 8.1 Client Credentials

The mobile app may contain:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The mobile app must never contain:

- a Supabase secret key;
- a legacy `service_role` key;
- database passwords;
- any administrator credentials capable of bypassing RLS.

Supabase documents that client applications can use a publishable key with RLS, while privileged keys must not be exposed to customers.

### 8.2 Student Authentication

On first use of Weekly Question:

1. The app initializes the Supabase client.
2. The app restores an existing anonymous auth session if available.
3. If no session exists, the app calls Supabase anonymous sign-in.
4. The app persists the session using the official Expo-supported session storage approach.
5. The app uses the authenticated anonymous user ID only for response ownership, reports, limits, and blocking.

The UI does not display sign-up/sign-in terminology. For text mode it can state: `Participation is anonymous; do not include identifying details in your answer.` For poll mode it can state: `Your selection is private and appears only in aggregate results.`

### 8.3 Anti-Abuse Controls

Supabase documentation states that anonymous sign-ins can be abused, recommends invisible CAPTCHA or Cloudflare Turnstile, and documents an IP-based anonymous sign-in rate limit of 30 requests per hour.

Version one release gating requirement:

- Validate a supported anti-bot flow for the Expo native client before enabling public anonymous responses.

If CAPTCHA or Turnstile integration is not reliable in the mobile app:

- do not launch open public responses solely protected by RLS;
- evaluate a protected server-side submission endpoint with rate limiting, or use Firebase App Check as part of a revised backend decision.

Database safeguards that remain required regardless of CAPTCHA:

- one response per anonymous identity per question, implemented as one text submission or one poll vote according to the cycle mode;
- maximum answer length for text questions and valid-option enforcement for polls;
- blocked-author check;
- open-submission-window check;
- no student reads of raw submissions or individual poll votes;
- no student updates to moderation fields;
- rate monitoring and a kill switch that can close submissions.

### 8.4 Administrator Access

Version one admin work occurs in Supabase Dashboard:

- create and publish questions;
- define and review poll options when the question mode requires them;
- monitor response counts;
- review raw text responses;
- mark responses approved or rejected;
- populate display slots manually or invoke random-approved assignment;
- publish or suppress eligible aggregate poll-result graphs;
- review reports;
- remove displayed content;
- block abusive anonymous identities;
- confirm end-of-cycle purge outcomes.

The current Haki `AdminGate` and local PIN must not authorize any remote write action. If an app-based administrator panel is later required, it must be designed as a separate enhancement using server-verifiable admin authentication and RLS or trusted backend enforcement.

## 9. Data Model Specification

### 9.1 General Rules

- Store remote feature data only in Supabase.
- Do not synchronize raw text submission bodies or individual poll votes into Haki's local SQLite database.
- Use UUID primary keys generated by the backend.
- Use `timestamptz` for all stored timestamps.
- Store `Asia/Manila` as the cycle display timezone for user-facing interpretation.
- Enable RLS on all exposed application tables.
- Do not enable Supabase Realtime for raw submission or moderation tables in v1.

### 9.2 Enumerated Status Values

The schema must constrain values equivalent to:

| Entity | Values |
| --- | --- |
| Cycle status | `draft`, `submissions_open`, `reviewing`, `display_active`, `display_complete`, `purged`, `cancelled` |
| Question mode | `open_text`, `multiple_choice_poll` |
| Selection mode | `manual`, `random_approved` for `open_text` cycles; null for polls |
| Submission status | `pending`, `approved`, `rejected`, `scheduled`, `removed`, `held_for_report` |
| Slot status | `empty`, `scheduled`, `removed`, `expired`, `purged` |
| Poll result status | `pending`, `published`, `below_threshold`, `removed`, `purged` |
| Report status | `open`, `reviewed`, `actioned`, `dismissed` |
| Block status | `active`, `expired`, `revoked` |

### 9.3 `weekly_question_cycles`

Purpose: Store one prompt and the schedule/lifecycle for a weekly feature cycle.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Cycle identifier |
| `prompt` | Text, required | Question displayed to students |
| `question_mode` | Constrained text | `open_text` or `multiple_choice_poll` |
| `status` | Constrained text | Lifecycle state |
| `selection_mode` | Constrained text, nullable | Manual or random-approved scheduling for text questions only |
| `display_timezone` | Text, required | Set to `Asia/Manila` in v1 |
| `submissions_open_at` | Timestamp with timezone | Beginning of submission access |
| `submissions_close_at` | Timestamp with timezone | End of submission access |
| `display_start_date_local` | Date | First of six display days for admin readability |
| `submission_character_limit` | Integer, nullable | Set for text mode; recommended v1 default: 280 |
| `poll_minimum_public_responses` | Integer, nullable | Set to 5 for poll mode in v1 |
| `policy_version` | Text | Submission policy accepted for this cycle |
| `created_at` | Timestamp with timezone | Audit timestamp |
| `published_at` | Timestamp with timezone, nullable | Time prompt became available |
| `display_completed_at` | Timestamp with timezone, nullable | Last slot completion |
| `purged_at` | Timestamp with timezone, nullable | Content purge completion |

Validation rules:

- Prompt must be non-empty and within an admin-defined maximum length.
- A text cycle requires `selection_mode` and a character limit; a poll cycle requires null `selection_mode`, at least two active options and the minimum response threshold.
- Submission close time must be after submission open time.
- Display must begin after submission close time.
- Once `submissions_open` begins, the prompt and policy version are immutable.
- Only one current cycle may be in an externally visible active state at one time.

### 9.4 `weekly_submissions`

Purpose: Temporarily store open-text student answers and moderation status. This table is used only when `question_mode = open_text`.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Submission identifier |
| `cycle_id` | UUID foreign key | Parent question cycle |
| `author_user_id` | UUID, required | Anonymous Supabase Auth user identifier |
| `answer_text` | Text, required until purged | Student-submitted response |
| `status` | Constrained text | Moderation state |
| `submitted_at` | Timestamp with timezone | Submission time |
| `reviewed_at` | Timestamp with timezone, nullable | Admin decision time |
| `removed_at` | Timestamp with timezone, nullable | Safety-removal time |
| `moderation_hold` | Boolean, default false | Prevents purge while an incident is unresolved |

Constraints:

- Unique `(cycle_id, author_user_id)` to enforce one answer per anonymous identity per cycle.
- Answer text length must be at least 1 non-whitespace character and at most the cycle limit.
- Student insertion always creates status `pending`; clients cannot choose approved or scheduled states.
- Student clients cannot read submissions, including their own answer body, after insertion.

The one-answer rule is device/session-based and must not be represented as verified one-person or one-student enforcement.

### 9.5 `weekly_poll_options`

Purpose: Store administrator-defined options for a `multiple_choice_poll` cycle.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Option identifier |
| `cycle_id` | UUID foreign key | Parent poll cycle |
| `label` | Text, required | Public option label, such as `Cat`, `Dog`, or `Other` |
| `display_order` | Integer | Stable graph and selection order |
| `created_at` | Timestamp with timezone | Audit timestamp |

Constraints:

- Each poll cycle has between two and six options.
- Labels are unique within a cycle and are limited to 40 characters.
- Students cannot create or alter options.
- Options are immutable after the cycle starts accepting votes.

### 9.6 `weekly_poll_votes`

Purpose: Temporarily store individual private choices for a `multiple_choice_poll` cycle.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Vote identifier |
| `cycle_id` | UUID foreign key | Parent poll cycle |
| `option_id` | UUID foreign key | Chosen option within the same cycle |
| `voter_user_id` | UUID, required | Anonymous Supabase Auth user identifier |
| `submitted_at` | Timestamp with timezone | Vote time |

Constraints:

- Unique `(cycle_id, voter_user_id)` enforces one vote per anonymous identity per poll.
- `option_id` must belong to `cycle_id`.
- Insert is permitted only during the cycle response window.
- Student clients cannot read, update or delete individual votes after insertion.
- Votes do not include free text or a moderation status.

### 9.7 `weekly_poll_results`

Purpose: Store a public aggregate snapshot after poll voting closes and before individual votes are purged.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Aggregate result record |
| `cycle_id` | UUID foreign key | Parent poll cycle |
| `option_id` | UUID foreign key | Related public option |
| `vote_count` | Integer | Number of valid votes for this option |
| `display_percentage` | Integer | Server-allocated percentage from 0 through 100 |
| `total_vote_count` | Integer | Total valid responses for the poll |
| `status` | Constrained text | Publication/removal/purge state |
| `calculated_at` | Timestamp with timezone | Snapshot time |
| `visible_from` | Timestamp with timezone | Graph publication start |
| `visible_until` | Timestamp with timezone | Graph publication end |

Rules:

- Generate results after voting closes; do not publish live totals.
- Result rows become public only if `total_vote_count >= 5`.
- `display_percentage` values for a public cycle must add to exactly 100 using the server-side largest-remainder calculation.
- Public results must never include `voter_user_id` or a join path available to student clients.
- If the threshold is not reached, store only non-public status/operational evidence needed to render the below-threshold state.

### 9.8 `weekly_display_slots`

Purpose: Represent twelve potential public display periods for each `open_text` cycle.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Slot identifier |
| `cycle_id` | UUID foreign key | Parent cycle |
| `slot_number` | Integer | Value 1 through 12 |
| `day_number` | Integer | Value 1 through 6 |
| `slot_period` | Constrained text | `morning` or `afternoon` |
| `visible_from` | Timestamp with timezone | Public display start |
| `visible_until` | Timestamp with timezone | Public display end |
| `submission_id` | UUID foreign key, nullable | Assigned approved answer |
| `status` | Constrained text | Scheduling/display state |
| `assigned_at` | Timestamp with timezone, nullable | Scheduling time |
| `removed_at` | Timestamp with timezone, nullable | Takedown time |

Rules:

- Slots are generated once when a cycle schedule is finalized.
- An assigned submission must belong to the same cycle and have status `approved` or `scheduled`.
- Public reads must expose an answer only when the slot is currently visible and not removed.
- Slot metadata may remain after purge for count and operational evidence, but it must not preserve answer text or author identity.

### 9.9 `weekly_reports`

Purpose: Capture student reports of displayed content.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Report identifier |
| `cycle_id` | UUID foreign key | Related question cycle |
| `slot_id` | UUID foreign key, nullable | Reported open-text display slot |
| `submission_id` | UUID foreign key, nullable | Open-text content under review |
| `reporter_user_id` | UUID | Anonymous reporting user |
| `reason` | Constrained text | Category selected by reporter |
| `note` | Text, nullable | Strictly length-limited optional context |
| `status` | Constrained text | Report handling state |
| `created_at` | Timestamp with timezone | Report submission time |
| `resolved_at` | Timestamp with timezone, nullable | Admin resolution time |

Rules:

- Open-text reports are unique per `(slot_id, reporter_user_id)`; poll prompt/graph reports are unique per `(cycle_id, reporter_user_id)`.
- A new open report about an open-text answer automatically places the associated submission under moderation hold until resolved.
- A new poll report may suppress the aggregate graph after administrator review, but does not create a hold on any individual vote because no student-authored text is displayed.
- The report insert response must not disclose the reported author's identifier.
- Once a report is resolved and the content no longer needs retention, the related answer can be purged.

### 9.10 `weekly_blocked_authors`

Purpose: Block repeated abusive anonymous identities without retaining their answers.

| Field | Type | Purpose |
| --- | --- | --- |
| `author_user_id` | UUID primary key | Blocked anonymous identity |
| `status` | Constrained text | Block state |
| `blocked_at` | Timestamp with timezone | Action timestamp |
| `expires_at` | Timestamp with timezone, nullable | Optional expiry |
| `reason_code` | Constrained text | Non-narrative moderation reason |

Rules:

- Do not store answer content in the blocked-author table.
- Text submissions and poll votes from an active blocked identity are rejected by backend policy.
- If a student changes anonymous identity, the block may be evaded; this limitation must be accepted for v1 or addressed through stronger anti-abuse measures later.

### 9.11 `weekly_cycle_metrics`

Purpose: Retain non-content operational statistics after answer content is deleted.

| Field | Type | Purpose |
| --- | --- | --- |
| `cycle_id` | UUID primary key | Cycle reference |
| `response_count` | Integer | Total text submissions or poll votes received |
| `approved_count` | Integer, nullable | Approved text response count; null for poll cycles |
| `displayed_count` | Integer, nullable | Published text slot count; null for poll cycles |
| `poll_result_published` | Boolean | Whether a qualifying aggregate graph was shown |
| `report_count` | Integer | Count of reports |
| `purge_completed_at` | Timestamp with timezone | Deletion confirmation |

This table must contain no answer text and no student/anonymous identity identifiers.

## 10. Public And Administrative API Contract

### 10.1 Client Read Operations

The mobile app needs only limited public read capabilities:

| Operation | Returned Data |
| --- | --- |
| Fetch current cycle state | Prompt, question mode, response window, display status, policy version and relevant input constraints |
| Fetch current displayed text answer | Current slot timing and selected answer text only when an open-text slot is visible |
| Fetch current poll result | Option labels, aggregate counts/percentages, total response count and display dates only when an eligible poll graph is public |
| Fetch student's response state | Whether this anonymous identity already responded for the cycle, not its stored text or selected option |
| Fetch policy content/version | Terms required before submitting |

The client must never receive:

- pending submissions;
- rejected submissions;
- approved answers not currently displayed;
- individual poll votes or voter identifiers;
- poll aggregates before voting closes or below the public threshold;
- anonymous author IDs;
- admin moderation notes;
- block records;
- other students' reports.

### 10.2 Client Write Operations

| Operation | Required Checks |
| --- | --- |
| Submit text answer | Text cycle; authenticated anonymous session; responses open; policy accepted; not blocked; no prior response; text length valid |
| Cast poll vote | Poll cycle; authenticated anonymous session; responses open; policy accepted; not blocked; no prior response; selected option belongs to cycle |
| Report displayed answer | Authenticated anonymous session; text answer currently or recently displayed; no duplicate report; valid reason |
| Report poll prompt/graph | Authenticated anonymous session; poll currently publicly visible; no duplicate cycle report; valid reason |

The student client cannot:

- approve, reject, schedule or delete answers;
- create or modify questions;
- modify display slots;
- read or calculate poll results from raw votes;
- read moderation queues;
- invoke purge or random scheduling.

To ensure a client cannot participate through the wrong mode, response insertion should be performed through mode-specific database functions or equivalent policies that validate `question_mode`: text rows can be created only for `open_text` cycles, and vote rows can be created only for `multiple_choice_poll` cycles.

### 10.3 Administrative Operations

Administrative operations occur only through trusted dashboard access or trusted backend execution:

| Operation | Effect |
| --- | --- |
| Create cycle | Create question, mode and initial dates; define poll options when applicable |
| Open responses | Make the cycle visible and writable during the open period |
| Review text response | Set a text answer to approved or rejected |
| Generate text slots | Create twelve UTC display slots from six Manila dates for open-text cycles |
| Assign slot manually | Connect one approved response to a slot |
| Assign slots randomly | Fill vacant slots from distinct approved responses only |
| Generate poll aggregate | Count private poll votes after close, apply threshold and allocate public graph percentages |
| Remove published content | Immediately stop public display and open or resolve associated moderation work |
| Block anonymous author | Prevent future writes from the same anonymous identity |
| Purge content | Delete answer bodies, individual votes and displayed aggregate values after cycle completion and holds resolution |

## 11. Row Level Security Requirements

### 11.1 RLS Baseline

RLS must be enabled on every exposed Weekly Question table. Policies should default to denial unless an operation is specifically required.

### 11.2 Student Access Rules

Policies must enforce the following behavior:

| Table/Interface | Student Read | Student Write |
| --- | --- | --- |
| Visible cycle projection | Read current published cycle only | None |
| Current displayed-answer projection | Read active non-removed scheduled answer only | None |
| Raw `weekly_submissions` | No direct reads | Insert own pending answer only |
| Poll options projection | Read active poll options only while accepting a vote or publishing the graph | None |
| Raw `weekly_poll_votes` | No direct reads | Insert own valid option vote only |
| Public poll-result projection | Read only public post-close aggregate snapshot meeting threshold | None |
| `weekly_reports` | No direct list reads | Insert report as current user only |
| `weekly_display_slots` | No unrestricted reads | None |
| Block table | No reads | None |
| Metrics | No reads required in v1 | None |

### 11.3 Insert Validation

Backend-enforced submission validation must ensure:

- `author_user_id` equals `auth.uid()`;
- the JWT is an authenticated anonymous session permitted by the feature;
- cycle is accepting responses at server time;
- user is not currently blocked;
- one response of the cycle's applicable mode exists at most once for the anonymous identity;
- for text mode, text is within configured length constraints, initial status is `pending`, and students cannot set review, scheduling, removal or hold fields;
- for poll mode, the selected option belongs to the same cycle and no free-text value is accepted.

### 11.4 Secure Public Read Projection

The app should read displayed open-text answers through a narrowly scoped view or remote procedure call that returns only:

- question prompt;
- active slot's `visible_from` and `visible_until`;
- active approved answer text;
- reporting identifier required by the report operation.

The app should read a displayed poll result through a separate narrowly scoped view or remote procedure call that returns only:

- question prompt and option labels;
- server-computed aggregate `display_percentage` values and total response count;
- aggregate visibility timestamps;
- cycle identifier required by the report operation.

The implementation must verify that any database view used for public access obeys RLS or is otherwise safely defined. Supabase documents that view security behavior requires attention; the engineer must not create a public view that accidentally bypasses table restrictions.

## 12. Data Retention And Deletion Plan

### 12.1 Retention Principle

For open-text cycles, the product collects student answer content only for:

1. moderation;
2. temporary selection;
3. temporary scheduled public display;
4. handling safety reports related to that display.

For poll cycles, the product collects a private selected option only for counting and temporary aggregate graph display. It does not require a permanent record of any individual's selection.

The product does not need a permanent archive of answer content, individual votes or public result graphs. Deleting response text, votes and aggregate-result rows after the weekly display completes is aligned with data minimization.

### 12.2 Important Storage Correction

Deleting text submissions and poll vote/result rows is appropriate for privacy and allows freed database space to be reused. It must not be described as an immediate free-tier quota reset.

Supabase documents:

- Free Plan projects are limited by 500 MB database size.
- PostgreSQL does not immediately reclaim physical space from deleted rows; deleted tuples are reclaimed through vacuum behavior.
- Supabase projects have automatic vacuuming enabled.
- Manual vacuum operations may be used where appropriate; `VACUUM FULL` locks the affected table and is not a routine per-cycle task.

For short text answers and choice-only poll votes, the storage footprint should be small. The strongest reason to purge is privacy and minimizing retained responses, not expected weekly storage pressure.

### 12.3 Purge Schedule

The purge eligibility rule is:

- An open-text cycle becomes purge-eligible after its twelfth and final display slot has ended.
- A poll cycle becomes purge-eligible after the six-day public graph display period has ended.
- Run purge processing after the final display period, recommended at least fifteen minutes later to avoid timing/race issues.
- For a normal six-day schedule ending at 4:59:59 PM Asia/Manila, a purge check may run after 5:15 PM Asia/Manila.
- Implement purge using a database-side function invoked manually during pilot testing and, once validated, by Supabase Cron.

The scheduled job must determine eligibility from UTC timestamps and state, not from client device clocks.

### 12.4 Content To Delete At Cycle Close

For open-text rows that are not subject to an unresolved report or safety hold, and for all completed poll rows regardless of poll prompt/graph reports, delete:

- every answer text submission row for the completed cycle, whether rejected, approved, selected or unselected;
- answer-to-slot content references as required to eliminate displayed text;
- every individual poll vote for the completed cycle;
- every public poll-result count and percentage row after its graph display period ends;
- resolved report free-text notes, if any were permitted;
- policy acceptance records that include an answer/submission relationship, unless needed only in aggregate.

After deletion, the app must not display past weekly answers or past poll graphs.

### 12.5 Limited Data To Retain

Retain only non-content operational records required to operate and demonstrate deletion:

- question text, fixed poll option labels and cycle schedule, unless the administrator also chooses to delete completed questions later;
- aggregate cycle metrics with no student identifiers;
- timestamps confirming purge completion;
- an active block record for a repeatedly abusive anonymous identity, without its deleted response text;
- unresolved report records/content under hold until the report is resolved.

### 12.6 Moderation Hold Exception

The system must not automatically delete content involved in an unresolved report at the end of the cycle. Doing so would remove the material before the administrator could evaluate or respond to a safety concern.

Hold workflow:

1. A report is filed about a displayed answer.
2. The linked submission is marked `moderation_hold = true`.
3. Cycle purge deletes all other eligible submissions.
4. Administrator reviews the reported answer and takes action.
5. Once the report is resolved, purge deletes the held answer content and any unnecessary report text.

This is the only content-retention exception to the requested last-day deletion policy.

Poll votes are not retained under a content-report hold because the student did not author the public prompt or option labels. If a poll graph or prompt is reported, the administrator may remove the graph immediately; its individual vote records remain scheduled for deletion at cycle close.

### 12.7 Anonymous Auth User Cleanup

Deleting `weekly_submissions` or `weekly_poll_votes` does not delete Supabase anonymous Auth users.

Supabase documentation states that automatic cleanup of anonymous users is currently unavailable and gives an example of deleting anonymous users older than 30 days. Therefore:

- Add a separate scheduled maintenance procedure for anonymous Auth user cleanup.
- Do not delete an anonymous Auth user that is referenced by an active block or unresolved report until the required control is complete.
- Run this cleanup independently from weekly answer-text purge.

## 13. App Implementation Architecture

### 13.1 New Application Domain

Introduce an isolated domain for this feature, conceptually under:

- a new route screen for Weekly Question;
- new UI components for prompt, text submission, option voting, answer display, poll-result chart, report and online-state handling;
- a non-blocking Home dashboard poll-results card for an active eligible poll cycle;
- a new service module for Supabase operations;
- new types and validation for question modes, response payloads and cycle/display states;
- small local cache support only for non-sensitive currently published display data if offline fallback is adopted.

The implementation must follow existing app architecture conventions after inspecting comparable route and service modules during execution.

### 13.2 App-Side States

The Weekly Question screen must support these states:

| State | UI Behavior |
| --- | --- |
| Offline with no cached public item | Explain that Weekly Question requires internet; offer retry |
| Loading | Loading indicator without assuming a question exists |
| No active cycle | Friendly empty state |
| Open-text responses open, not submitted | Show prompt, policy notice and text answer form |
| Poll responses open, not submitted | Show prompt, policy notice and fixed single-choice controls; do not show results |
| Responses open, already responded | Show anonymous participation receipt; do not reveal/edit stored text or selected choice |
| Open-text review period | Explain that answers are being reviewed |
| Poll counting period | Explain that poll results will be available after processing if enough students responded |
| Text display active within a filled slot | Show prompt, anonymous answer and Report control |
| Display active within an empty slot | Show that no response is scheduled for this time |
| Poll display active, threshold reached | Show percentage graph, total response count and Report control |
| Poll display active, threshold not reached | Show insufficient-responses message without counts or percentages |
| Outside display slot during display days | Show next answer availability time |
| Removed text answer or suppressed poll graph | Show that the response or result is unavailable |
| Network/server failure | Preserve the rest of Haki; offer retry for only this feature |

### 13.3 Open-Text Submission Form

Submission screen requirements:

- Prompt is shown prominently.
- Text input is plain text only.
- Recommended default maximum length is 280 characters.
- Remaining-character count is visible.
- Links are not accepted or are treated as plain text and rejected by moderation policy.
- Student must affirm the policy/publication notice before submitting.
- Submit button is disabled after successful submission.
- The screen does not solicit a name, alias, avatar, program, year level or contact information.

### 13.4 Multiple-Choice Voting Form

Poll voting requirements:

- Prompt and all administrator-defined options are shown prominently.
- The student can select exactly one option.
- If `Other` exists, it is a selectable fixed option without a text field.
- The student must affirm the participation/privacy notice before submitting the vote.
- Results and vote counts are not shown while responses remain open.
- After a successful vote, the form is replaced with a receipt state and cannot be changed in v1.
- The screen does not solicit any identity or explanatory text.

### 13.5 Open-Text Display Card

A public answer card must display:

- weekly prompt;
- `Anonymous student response` label;
- answer text;
- current time-slot information;
- a brief reminder that responses are peer thoughts, not official university advice;
- a `Report` action.

Do not show:

- identifiers;
- submission time;
- status information;
- moderation decision notes;
- total vote counts, ranking or popularity indicators.

### 13.6 Home Poll Results Graph

When an eligible `multiple_choice_poll` result is active, the Haki Home screen must show a visually distinct dashboard card:

| Card Element | Requirement |
| --- | --- |
| Label | `Weekly Question Results` and `Anonymous poll` |
| Prompt | Display the administrator-created question |
| Chart | Horizontal bar for each option, ordered by configured `display_order` |
| Values | Show server-generated whole-number percentage for every option and total number of responses |
| Navigation | Card opens the dedicated Weekly Question screen for context and reporting |
| Report action | Available on the detail screen; may also appear directly on the card if layout remains usable |

Implementation guidance:

- Build the chart using standard React Native `View` bars and `Text`; a charting dependency is unnecessary for a small categorical bar graph.
- Use percentage values generated by the backend; do not derive percentages in the Home screen.
- Supply accessible labels such as `Cat, 45 percent of 40 responses` for each bar.
- Do not use color alone to communicate the option or value.
- Animate card entrance consistently with existing Home dashboard cards, but respect the app's reduced-motion setting.
- Fetch the public aggregate without blocking existing Home content; a network failure must not make the offline-first Home screen unusable.
- During an active open-text cycle, Home may link to Weekly Question but must not preview unmoderated or non-current answer content.

### 13.7 Offline Handling

This feature is explicitly online-first while Haki remains offline-first overall.

Version one default:

- Do not cache submitted answer text or a student's selected poll option locally after successful upload.
- Do not queue offline text submissions or poll votes.
- If offline, disable participation and display an internet-required message within the Weekly Question screen.
- If Home cannot fetch an active poll graph, omit its result bars or show a non-blocking online-only placeholder; do not interrupt existing Home content.
- Existing app capabilities must remain usable when Weekly Question cannot connect.

Optional later enhancement:

- Cache the currently displayed public answer for read-only fallback, marked with its last fetched timestamp and potentially-outdated status.

The optional cache is not part of v1 because the feature is time-slot-sensitive and stale public display may confuse users.

## 14. Administrative Operating Procedure

### 14.1 Before A New Cycle

Administrator actions:

1. Create a new cycle in the Supabase Dashboard.
2. Select `open_text` or `multiple_choice_poll`.
3. Enter a prompt that complies with prompt safety rules.
4. For a poll, enter and review two to six fixed options, including `Other` only as a non-typed choice when appropriate.
5. Set response opening and closing timestamps.
6. Set the first of six display dates.
7. For an open-text cycle, select `manual` or `random_approved` mode.
8. Verify the participation/privacy notice version.
9. Publish the cycle for student response.

### 14.2 During Submission Day

Administrator actions:

- Observe response count and system errors.
- For open text, do not expose pending content in the app.
- For polls, do not expose live totals or percentages in the app.
- Close the cycle early only for a safety incident or system abuse; record the reason outside public content.

### 14.3 During Review

For each open-text submission:

1. Reject content containing identifying details, even if otherwise kind.
2. Reject content naming or describing another identifiable person.
3. Reject harmful, offensive, spam, sexual, illegal, or policy-breaking content.
4. Approve only responses suitable for anonymous public display.
5. Block anonymous author IDs only when behavior warrants future prevention.

For a poll cycle, there is no student-authored text to moderate. Confirm that the configured prompt/options remain appropriate and that the result threshold is met before exposing the aggregate graph.

### 14.4 Scheduling Display

Manual mode:

- Assign each approved response to an intended slot.
- Inspect all populated slots before activating display.

Random-approved mode:

- Approve safe candidate content first.
- Invoke random assignment for vacant slots only.
- Inspect generated assignments before activating display.

Poll mode:

- After voting closes, invoke aggregate result generation.
- Confirm that a result meeting the five-response threshold is scheduled for Home display across the six display days.
- If the threshold is not met, confirm that only the insufficient-responses state is public.

### 14.5 During Display Days

Administrator actions:

- Review reports within a stated operational response window.
- Remove an answer immediately if it exposes personal information or presents an urgent safety concern.
- Mark affected content under hold while resolving reports.
- Remove a poll graph if its administrator-created prompt or choices are discovered to be inappropriate; individual student votes are never shown.

### 14.6 At Cycle Completion

Administrator/system actions:

1. Confirm the final text display slot or poll graph visibility period has expired.
2. Identify unresolved open-text reports and apply moderation holds.
3. Execute or verify content purge for all other text submissions and all completed poll vote/result records.
4. Resolve held reports and purge held content once no longer required.
5. Confirm aggregate counts and purge-completion timestamp.
6. Periodically clean up anonymous authentication records under the separate maintenance policy.

## 15. Failure Modes And Required Handling

| Failure Mode | Required Behavior |
| --- | --- |
| Student is offline | No response attempt; explain online requirement; Home remains functional without poll graph |
| Text submission or poll vote times out | Do not assume success; re-check response status before allowing retry |
| Anonymous auth session cannot be established | Disable submission and report temporary error |
| Student responds twice | Database constraint rejects second write; UI shows already responded |
| Spam wave or automated anonymous users | Close submissions, review rate controls, investigate CAPTCHA/endpoint controls |
| Admin approves fewer than twelve responses | Empty slots display neutral no-response text |
| Random scheduling has fewer than twelve approved candidates | Schedule each eligible answer at most once; leave remainder empty |
| Poll has fewer than five valid votes | Do not publish percentages; show insufficient-responses state |
| Poll graph fetch fails on Home | Do not block Home rendering; omit graph or show non-blocking unavailable state |
| Percentages would not sum to 100 through naive rounding | Use server-side largest-remainder allocation and serve fixed display percentages |
| Published answer is reported | Place under hold; allow admin removal; prevent content purge until resolved |
| Purge job fails | Alert administrator through dashboard monitoring; retry safely |
| Purge removes rows but storage metric does not immediately decline | Recognize expected PostgreSQL vacuum behavior; do not create emergency deletion logic |
| Supabase project unavailable or paused | Weekly feature shows unavailable state; local Haki features remain functional |
| Malicious client attempts admin operations | RLS denies operation; no service credentials exist in the app |

## 16. Test Strategy

### 16.1 Unit And Validation Tests

Test:

- question prompt validation;
- question mode validation and poll-option constraints;
- answer length and whitespace validation;
- one-choice vote validation and no-text `Other` behavior;
- date/slot generation for six days and two slots per day;
- Manila-time to UTC conversion;
- percentage allocation for zero responses, below-threshold responses, equal vote counts and rounding remainder cases;
- cycle-state presentation logic;
- report reason validation;
- safe display state when a slot is empty, removed, expired or not yet active.

### 16.2 Service Integration Tests

Against a development Supabase project or local Supabase environment, verify:

- an anonymous session can obtain the permitted public cycle data;
- one anonymous user can submit one answer in an open cycle;
- the same identity cannot submit a second answer in that cycle;
- a different anonymous identity can submit its own answer;
- one anonymous user can cast exactly one vote in a poll cycle;
- a poll vote cannot target an option from another cycle or contain typed `Other` content;
- writes fail outside the submission window;
- writes fail for blocked identities;
- student clients cannot select raw submission rows;
- student clients cannot select raw poll votes or pre-close aggregates;
- student clients cannot update moderation status;
- student clients cannot create or alter display slots;
- a visible assigned slot returns only its active answer;
- a future, expired or removed slot does not expose answer text;
- a report creates a hold condition;
- a qualifying closed poll returns only its public aggregate graph snapshot;
- a below-threshold poll returns no percentages or counts;
- purge deletes non-held text content, individual poll votes and expired public result snapshots while preserving held reported text content until resolution.

### 16.3 RLS Adversarial Tests

Use direct client calls with the mobile publishable key to attempt:

- fetching all raw submissions;
- fetching individual poll votes;
- fetching poll totals before closing time or below the minimum response threshold;
- selecting approved-but-not-yet-visible answers;
- approving the submitter's own content;
- setting a submission author ID belonging to another user;
- assigning a submission to a slot;
- reading block records;
- invoking purge;
- bypassing submission limits.
- submitting more than one poll vote or an option not belonging to the active poll.

All attempts must fail at the backend regardless of UI behavior.

### 16.4 Administrative Workflow Tests

Verify:

- a cycle can be drafted, opened, reviewed, scheduled, completed and purged;
- manual assignment supports fewer than twelve responses;
- random-approved assignment selects only approved records and does not duplicate answers unless explicitly allowed by later product change;
- a poll computes percentages only after close, exposes the Home graph only at or above five votes, and removes it after the six-day display period;
- removing a live answer immediately prevents future public reads;
- cycles with unresolved reports are only partially purged.

### 16.5 UI Scenario Tests

Test on representative mobile devices:

- new anonymous participant submits once;
- new anonymous participant votes once in a multiple-choice poll without seeing live results;
- returning participant sees receipt state;
- display card appears only during scheduled interval;
- eligible poll graph appears on Home and displays accessible bars, labels, percentages and total response count;
- an ineligible poll shows no result distribution;
- report flow completes;
- online failure does not block navigation to offline Haki capabilities;
- no Tips & Tricks screen behavior changes;
- no Haki chat or official information behavior changes.

### 16.6 Privacy And Content Review Checks

Before release, manually verify:

- policy is shown before submission;
- no requested input field solicits identity;
- poll questions accept only fixed choices and never collect free-text `Other` detail;
- screens clearly label responses as anonymous peer content;
- the Home graph clearly identifies results as an anonymous student poll rather than an official university statistic;
- all displayed content can be reported;
- administrators can remove content and block identities;
- deleted cycles cannot be retrieved publicly;
- no answer text exists in local device logs or analytics payloads.

## 17. Release Phases

### Phase 0: Backend And Moderation Prototype

Purpose: Validate the data lifecycle before student use.

- Create development Supabase project.
- Define tables, RLS, anonymous-auth configuration and dashboard workflow.
- Use synthetic non-campus/non-personal test text only.
- Verify slot scheduling and purge behavior.
- Verify poll option, aggregation, threshold, Home graph projection and poll-vote purge behavior.
- Validate anti-abuse option suitable for Expo.

Exit criteria:

- RLS adversarial tests pass.
- Admin can review/schedule/purge without using app-side admin mode.
- Anonymous sign-in abuse mitigation strategy is confirmed.

### Phase 1: App Read-Only Pilot

Purpose: Verify online screen behavior without accepting live student UGC.

- Add Weekly Question route, open-text display UI and Home poll-result graph card.
- Load administrator-created safe sample responses and synthetic aggregate poll results from backend.
- Test online failure and time-slot presentation.

Exit criteria:

- No regression to offline Haki behavior.
- Scheduled display works in Asia/Manila slots.
- Poll graph renders without blocking or changing existing Home functionality.

### Phase 2: Controlled Submission Pilot

Purpose: Accept real student answers with close moderation.

- Enable anonymous responses for a limited participant group or controlled announcement.
- Operate manual selection only.
- Introduce polls only with fixed low-risk options and minimum result threshold enabled.
- Monitor responses, poll publication thresholds, reports and purge results each cycle.

Exit criteria:

- Moderation workload is manageable.
- Reporting and removal flows work.
- No raw content exposure or RLS failures are found.
- End-of-cycle purge is verified.

### Phase 3: General Release

Purpose: Release the stable feature broadly.

- Keep manual selection as the default.
- Enable `random_approved` only after approval queue practices are stable.
- Review free-tier usage and abuse metrics every cycle.

## 18. Acceptance Criteria

The feature is ready for initial production only when all of the following are true:

1. Weekly Question is visibly separate from Tips & Tricks and Haki official answers.
2. Students can participate anonymously without a conventional account UI.
3. The backend maintains an anonymous internal identity for rules and moderation.
4. Each cycle is fixed as either open-text or multiple-choice poll before responses begin.
5. No student can read raw text submissions, individual poll votes or non-public aggregate results.
6. No unreviewed text submission can be published or randomly selected.
7. Up to twelve text slots can be scheduled for six days at two slots per day.
8. A poll accepts only fixed administrator-defined choices, computes percentages after voting closes and publishes a Home graph only when at least five valid responses exist.
9. Public poll percentage labels add to exactly 100% and the graph includes the total valid response count.
10. Manila-time scheduling is consistently converted and enforced using backend timestamps.
11. Students see a policy/privacy notice before responding.
12. Students can report visible content in the app.
13. Administrators can remove content and block an abusive anonymous identity.
14. Remote admin operations cannot be authorized by the current local Haki admin PIN.
15. Answer content, individual poll votes and expired poll-result graph data are purged after the completed display cycle except text content under unresolved-report hold.
16. The team understands that deletion makes space reusable but may not instantly reduce Supabase database metrics.
17. Existing offline functionality, Tips content and official campus-answer behavior are unchanged.
18. Platform UGC requirements and Philippine privacy notice requirements have been reviewed before store release.

## 19. Open Product Decisions To Confirm Before Coding

The architecture above establishes safe defaults. The project owner must confirm these presentation decisions before implementation begins:

| Decision | Recommended Default |
| --- | --- |
| Public feature name | `Weekly Question` |
| Home access | New Home entry card; active qualifying polls additionally render an aggregate graph card on Home |
| Question modes | `open_text` and `multiple_choice_poll` |
| Answer character limit | 280 characters |
| Poll option limit | Two to six fixed administrator-defined options, 40 characters each |
| Poll `Other` behavior | Fixed option only; no student-entered explanatory text |
| Poll result privacy threshold | Display graph only at five or more valid votes |
| Poll percentage display | Whole-number percentages allocated server-side to total exactly 100% |
| Default cycle calendar | Monday submissions, Tuesday-Sunday display |
| Selection default | Manual selection; random-approved available only after pilot |
| Missing approved answers | Leave slot empty with neutral message |
| Display outside 9 AM-5 PM slots | Show next availability, not the previous response |
| Report response expectation | Administrator reviews during each display day |
| Retention exception | Preserve only content with unresolved reports until resolution |

If any recommended default changes, update the privacy notice, tests and moderation procedure accordingly before release.

## 20. Official Fact Sources

The following official sources informed the feasibility and implementation requirements as checked on May 26, 2026:

1. Supabase, About Billing on Supabase: free project and quota documentation.  
   <https://supabase.com/docs/guides/platform/billing-on-supabase>
2. Supabase, Anonymous Sign-Ins: anonymous user model, abuse warning, CAPTCHA/Turnstile recommendation, IP rate limit and anonymous-user cleanup limitation.  
   <https://supabase.com/docs/guides/auth/auth-anonymous>
3. Supabase, Row Level Security: exposed-table protection, authenticated/anonymous role behavior and privileged key safety.  
   <https://supabase.com/docs/guides/database/postgres/row-level-security>
4. Supabase, Use Supabase with Expo React Native: official Expo client integration and publishable-key setup.  
   <https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native>
5. Supabase, Cron: documented scheduled database jobs using `pg_cron`.  
   <https://supabase.com/docs/guides/cron>
6. Supabase, Understanding Database and Disk Size: free-plan database size behavior, deletion, vacuuming and storage reporting.  
   <https://supabase.com/docs/guides/platform/database-size>
7. Firebase, Cloud Firestore Pricing: alternative backend free-quota documentation.  
   <https://firebase.google.com/docs/firestore/pricing>
8. Firebase, Anonymous Authentication: alternative anonymous-user support.  
   <https://firebase.google.com/docs/auth/web/anonymous-auth>
9. Firebase, App Check: alternative app/device-attestation capability.  
   <https://firebase.google.com/docs/app-check>
10. Apple, App Review Guidelines section 1.2: UGC moderation, reporting, blocking and contact requirements.  
    <https://developer.apple.com/app-store/review/guidelines/#user-generated-content>
11. Google Play, User Generated Content Policy: UGC terms acceptance, moderation, reporting and blocking requirements.  
    <https://support.google.com/googleplay/android-developer/answer/9876937?hl=en>
12. Philippine National Privacy Commission, Republic Act No. 10173 - Data Privacy Act of 2012: personal information, processing, retention and accountability requirements.  
    <https://privacy.gov.ph/data-privacy-act/>

## 21. Final Recommendation

Build Weekly Question as a new, online-only community feature with Supabase as the version-one backend and two supported modes. For open-text questions, keep student interaction anonymous in the interface while using anonymous authenticated backend sessions for control and moderation, use manual dashboard moderation first, permit random display only from approved content, and display two answers per day across six days using Manila-time slots. For multiple-choice polls, accept only administrator-defined options, keep individual votes private, calculate aggregate percentages after voting closes, and show eligible percentage results as a graph on the Haki Home screen during the six display days.

Purge student answer content, individual poll votes and no-longer-displayed poll-result rows after the final display period except where an unresolved text report requires temporary retention. This design preserves Haki's offline-first and official-answer boundaries while delivering both anonymous thought sharing and privacy-conscious preference polls with a defensible security and store-compliance foundation.
