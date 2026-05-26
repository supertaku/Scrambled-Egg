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
| Publication model | Two approved answers per display day for six days |
| Content deletion policy | Purge answer text after the final display slot, except content under an unresolved moderation hold |
| Source verification date | May 26, 2026 |

## 1. Executive Summary

Weekly Question is a new online-only social feature in which an administrator posts a simple weekly prompt and students anonymously submit short written answers. After one submission day, selected answers are displayed to the student audience at two scheduled times per day for six display days.

Example prompts:

- "What is the best advice given to you by someone?"
- "What do you like more, cats or dogs?"

This feature is feasible in the current Haki project because it can be added as an independent online module without changing the local AI system, official campus retrieval behavior, or offline availability of existing features.

The implementation must treat student answers as user-generated content (UGC), even when questions are casual and expected responses are harmless. Students can type text that contains harassment, personal information, offensive material, or misinformation regardless of the question. For that reason:

- Raw submissions must never be shown publicly.
- Random display may operate only on administrator-approved answers.
- Reporting, removal, and abusive-user blocking controls are required.
- Student answers must never become Haki knowledge sources or official campus answers.

The recommended v1 implementation uses Supabase because the feature is naturally relational: one cycle has one question, many submissions, moderation decisions, up to twelve publication slots, and optional reports. Supabase offers official Expo React Native integration, anonymous authentication, Row Level Security (RLS), dashboard-based moderation, and documented scheduling support through Supabase Cron.

## 2. Goals And Non-Goals

### 2.1 Goals

The implementation must:

1. Provide a distinct Weekly Question experience for Haki users.
2. Allow students to participate without creating visible accounts or submitting identity fields.
3. Accept one short text response from an anonymous app user for each weekly question.
4. Hold all submissions for moderation before they can be displayed.
5. Support administrator manual selection or random selection from approved content only.
6. Display two answers per day for six days, for up to twelve displayed answers per cycle.
7. Keep publication scheduling consistent in Philippine time.
8. Provide controls to report published content and suppress content when necessary.
9. Purge student answer text after each completed weekly display cycle, subject to unresolved-report holds.
10. Operate without affecting Haki's offline assistant behavior or authoritative campus-content rules.

### 2.2 Non-Goals For Version One

Version one must not include:

- Replies, comments, reactions, likes, follower features, direct messages, or student profiles.
- Student images, attachments, hyperlinks, audio, video, or rich media.
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
| Weekly prompts, submissions, moderation, scheduled displays, reports | New remote Weekly Question module |
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

The screen must visually label displayed content as anonymous student responses, not university guidance.

## 4. Product Experience

### 4.1 Navigation Placement

Version one should introduce a new route rather than combining the feature with Tips & Tricks.

Recommended entry model:

- Create a dedicated Weekly Question screen reachable from a card or action on Home.
- Keep the existing five primary tabs unchanged for v1 to avoid overcrowding the bottom navigation.
- A future product decision may promote Weekly Question to a tab if engagement justifies it.

Recommended user-facing feature name:

- Screen title: `Weekly Question`
- Supporting label: `Anonymous student responses`

### 4.2 Weekly Cycle

Each weekly cycle consists of one submission period and six display days:

| Stage | Duration | Student Experience | Admin Experience |
| --- | --- | --- | --- |
| Draft | Before publishing | No new question shown | Admin creates prompt and dates |
| Submission open | One full day | Students see the prompt and submit once | Admin may observe submission count only |
| Review and scheduling | After close, before first display slot | Submissions closed; display start message shown | Admin approves/rejects and schedules answers |
| Display active | Six days | Students see the current displayed answer | Admin handles reports/removal |
| Cycle closed | After last display slot | No prior answer content exposed | Purge runs, subject to report holds |

### 4.3 Default Calendar Template

The implementation must not hardcode a weekday, because an administrator may need to skip holidays or adjust a cycle. Instead, each question stores its own opening, closing, and display dates.

The administrative default template is:

| Day | Phase |
| --- | --- |
| Monday, 12:00 AM to 11:59 PM Asia/Manila | Submissions open |
| Tuesday through Sunday | Six display days |

The administrator may choose a different start date before publishing the question. Once submissions open, the schedule must not be edited in a way that shortens already communicated participation or display periods.

### 4.4 Display Slots

Each display day has two answer slots:

| Slot | Local Display Period |
| --- | --- |
| Morning slot | 9:00 AM through 12:59:59 PM Asia/Manila |
| Afternoon slot | 1:00 PM through 4:59:59 PM Asia/Manila |

Outside those periods, the feature displays the weekly question and an appropriate status, but does not expose a scheduled answer unless the product later explicitly adds an overnight persistence behavior.

Technical time rule:

- User-facing scheduling is interpreted in `Asia/Manila`.
- Persist schedule timestamps as UTC `timestamptz` values.
- Calculate the twelve slots when a cycle is scheduled, rather than calculating them differently on individual clients.

### 4.5 Insufficient Approved Answers

A normal full cycle requires twelve approved answers. A cycle may receive fewer than twelve safe answers.

Version one behavior is:

- Do not publish rejected or unreviewed answers to fill missing slots.
- Do not repeat the same answer automatically.
- Any unscheduled slot displays: `No student response is scheduled for this time.`
- The admin may manually reuse an approved answer only if intentionally scheduled more than once before the display period starts.

This prioritizes trust and predictable moderation over artificially filling all slots.

## 5. Selection Modes

### 5.1 Supported Modes

Each cycle has one selection mode:

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

## 6. Safety, UGC And Privacy Requirements

### 6.1 Why Moderation Still Applies

Simple prompts lower expected risk but do not eliminate open-text risk. A participant can submit:

- identifying personal information;
- harassment or insults;
- discriminatory, violent or sexual content;
- spam or advertisements;
- accusations about real people;
- misleading claims presented as advice.

This is UGC when it becomes visible to another user. Apple App Review Guideline 1.2 and the Google Play UGC policy therefore apply if the app is distributed through those stores.

### 6.2 Student Submission Policy

Before the first submission for a question, the student must accept a concise content policy and publication notice. Acceptance is recorded per anonymous session and policy version.

Required policy points:

- Responses may be displayed anonymously to other students if selected.
- Do not submit your name, student number, class/section, contact details, account handle, or location.
- Do not identify, accuse, insult, threaten, or reveal information about another person.
- Do not submit sexual, violent, discriminatory, illegal, or promotional content.
- Answers are moderated and may be rejected, removed, or reported.
- Haki may block abusive anonymous participation.
- Submitted text is deleted after the completed display cycle unless it is temporarily retained to resolve a report or safety issue.

### 6.3 Prompt Safety Rules

Administrators must select prompts that solicit low-risk general opinions or experiences.

Allowed prompt characteristics:

- preference questions;
- general reflection questions;
- positive college-life or hobby discussion;
- no need to name people, courses, instructors, offices, or incidents.

Prompts to avoid:

- requests to name a best or worst instructor, classmate, office, organization, or employee;
- prompts encouraging allegations or complaints about identifiable people;
- mental health, medical, financial hardship, disciplinary, relationship, or sexual-experience disclosures;
- political or religious confrontation questions;
- prompts inviting cheating, leaked exams, or academic dishonesty.

### 6.4 Reporting And Blocking

Displayed answers must provide a report action while they are visible.

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
- Collect only the text, anonymous technical identity, required moderation fields, and operational timestamps.
- Do not request student number, full name, email, profile, course, year level, or demographic information.
- Document the purpose: moderation and temporary anonymous public display of selected responses.
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
| Structured moderation and slots | PostgreSQL tables naturally represent cycles, submissions, reports and slots |
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
5. The app uses the authenticated anonymous user ID only for submission ownership, reports, limits, and blocking.

The UI does not display sign-up/sign-in terminology. It can state: `Participation is anonymous; do not include identifying details in your answer.`

### 8.3 Anti-Abuse Controls

Supabase documentation states that anonymous sign-ins can be abused, recommends invisible CAPTCHA or Cloudflare Turnstile, and documents an IP-based anonymous sign-in rate limit of 30 requests per hour.

Version one release gating requirement:

- Validate a supported anti-bot flow for the Expo native client before enabling public anonymous submission.

If CAPTCHA or Turnstile integration is not reliable in the mobile app:

- do not launch open public submissions solely protected by RLS;
- evaluate a protected server-side submission endpoint with rate limiting, or use Firebase App Check as part of a revised backend decision.

Database safeguards that remain required regardless of CAPTCHA:

- one submission per anonymous identity per question;
- maximum answer length;
- blocked-author check;
- open-submission-window check;
- no student reads of raw submissions;
- no student updates to moderation fields;
- rate monitoring and a kill switch that can close submissions.

### 8.4 Administrator Access

Version one admin work occurs in Supabase Dashboard:

- create and publish questions;
- monitor submission counts;
- review raw responses;
- mark responses approved or rejected;
- populate display slots manually or invoke random-approved assignment;
- review reports;
- remove displayed content;
- block abusive anonymous identities;
- confirm end-of-cycle purge outcomes.

The current Haki `AdminGate` and local PIN must not authorize any remote write action. If an app-based administrator panel is later required, it must be designed as a separate enhancement using server-verifiable admin authentication and RLS or trusted backend enforcement.

## 9. Data Model Specification

### 9.1 General Rules

- Store remote feature data only in Supabase.
- Do not synchronize raw submission bodies into Haki's local SQLite database.
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
| Selection mode | `manual`, `random_approved` |
| Submission status | `pending`, `approved`, `rejected`, `scheduled`, `removed`, `held_for_report` |
| Slot status | `empty`, `scheduled`, `removed`, `expired`, `purged` |
| Report status | `open`, `reviewed`, `actioned`, `dismissed` |
| Block status | `active`, `expired`, `revoked` |

### 9.3 `weekly_question_cycles`

Purpose: Store one prompt and the schedule/lifecycle for a weekly feature cycle.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Cycle identifier |
| `prompt` | Text, required | Question displayed to students |
| `status` | Constrained text | Lifecycle state |
| `selection_mode` | Constrained text | Manual or random-approved scheduling |
| `display_timezone` | Text, required | Set to `Asia/Manila` in v1 |
| `submissions_open_at` | Timestamp with timezone | Beginning of submission access |
| `submissions_close_at` | Timestamp with timezone | End of submission access |
| `display_start_date_local` | Date | First of six display days for admin readability |
| `submission_character_limit` | Integer | Set by configuration; recommended v1 default: 280 |
| `policy_version` | Text | Submission policy accepted for this cycle |
| `created_at` | Timestamp with timezone | Audit timestamp |
| `published_at` | Timestamp with timezone, nullable | Time prompt became available |
| `display_completed_at` | Timestamp with timezone, nullable | Last slot completion |
| `purged_at` | Timestamp with timezone, nullable | Content purge completion |

Validation rules:

- Prompt must be non-empty and within an admin-defined maximum length.
- Submission close time must be after submission open time.
- Display must begin after submission close time.
- Once `submissions_open` begins, the prompt and policy version are immutable.
- Only one current cycle may be in an externally visible active state at one time.

### 9.4 `weekly_submissions`

Purpose: Temporarily store student answers and moderation status.

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

### 9.5 `weekly_display_slots`

Purpose: Represent twelve potential public display periods for each cycle.

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

### 9.6 `weekly_reports`

Purpose: Capture student reports of displayed content.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | UUID primary key | Report identifier |
| `slot_id` | UUID foreign key | Reported display slot |
| `submission_id` | UUID foreign key | Content under review |
| `reporter_user_id` | UUID | Anonymous reporting user |
| `reason` | Constrained text | Category selected by reporter |
| `note` | Text, nullable | Strictly length-limited optional context |
| `status` | Constrained text | Report handling state |
| `created_at` | Timestamp with timezone | Report submission time |
| `resolved_at` | Timestamp with timezone, nullable | Admin resolution time |

Rules:

- One report per `(slot_id, reporter_user_id)`.
- A new open report automatically places the associated submission under moderation hold until resolved.
- The report insert response must not disclose the reported author's identifier.
- Once a report is resolved and the content no longer needs retention, the related answer can be purged.

### 9.7 `weekly_blocked_authors`

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
- Submissions from an active blocked identity are rejected by backend policy.
- If a student changes anonymous identity, the block may be evaded; this limitation must be accepted for v1 or addressed through stronger anti-abuse measures later.

### 9.8 `weekly_cycle_metrics`

Purpose: Retain non-content operational statistics after answer content is deleted.

| Field | Type | Purpose |
| --- | --- | --- |
| `cycle_id` | UUID primary key | Cycle reference |
| `submission_count` | Integer | Total submitted responses |
| `approved_count` | Integer | Approved response count |
| `displayed_count` | Integer | Published slot count |
| `report_count` | Integer | Count of reports |
| `purge_completed_at` | Timestamp with timezone | Deletion confirmation |

This table must contain no answer text and no student/anonymous identity identifiers.

## 10. Public And Administrative API Contract

### 10.1 Client Read Operations

The mobile app needs only limited public read capabilities:

| Operation | Returned Data |
| --- | --- |
| Fetch current cycle state | Prompt, submission status/window, display status, policy version and character limit |
| Fetch current displayed answer | Current slot timing and selected answer text only when visible |
| Fetch student's submission state | Whether this anonymous identity already submitted for the cycle, not the stored answer body |
| Fetch policy content/version | Terms required before submitting |

The client must never receive:

- pending submissions;
- rejected submissions;
- approved answers not currently displayed;
- anonymous author IDs;
- admin moderation notes;
- block records;
- other students' reports.

### 10.2 Client Write Operations

| Operation | Required Checks |
| --- | --- |
| Submit answer | Authenticated anonymous session; submissions open; policy accepted; not blocked; no prior submission; text length valid |
| Report displayed answer | Authenticated anonymous session; answer currently or recently displayed; no duplicate report; valid reason |

The student client cannot:

- approve, reject, schedule or delete answers;
- create or modify questions;
- modify display slots;
- read moderation queues;
- invoke purge or random scheduling.

### 10.3 Administrative Operations

Administrative operations occur only through trusted dashboard access or trusted backend execution:

| Operation | Effect |
| --- | --- |
| Create cycle | Create question and initial dates |
| Open submissions | Make the cycle visible and writable during the open period |
| Review response | Set answer to approved or rejected |
| Generate slots | Create twelve UTC display slots from six Manila dates |
| Assign slot manually | Connect one approved response to a slot |
| Assign slots randomly | Fill vacant slots from distinct approved responses only |
| Remove published content | Immediately stop public display and open or resolve associated moderation work |
| Block anonymous author | Prevent future writes from the same anonymous identity |
| Purge content | Delete answer bodies/content rows after cycle completion and holds resolution |

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
| `weekly_reports` | No direct list reads | Insert report as current user only |
| `weekly_display_slots` | No unrestricted reads | None |
| Block table | No reads | None |
| Metrics | No reads required in v1 | None |

### 11.3 Insert Validation

Backend-enforced submission validation must ensure:

- `author_user_id` equals `auth.uid()`;
- the JWT is an authenticated anonymous session permitted by the feature;
- cycle is accepting submissions at server time;
- user is not currently blocked;
- the unique one-submission-per-cycle constraint is satisfied;
- text is within configured length constraints;
- initial status is `pending`;
- students cannot set review, scheduling, removal or hold fields.

### 11.4 Secure Public Read Projection

The app should read displayed answers through a narrowly scoped view or remote procedure call that returns only:

- question prompt;
- active slot's `visible_from` and `visible_until`;
- active approved answer text;
- reporting identifier required by the report operation.

The implementation must verify that any database view used for public access obeys RLS or is otherwise safely defined. Supabase documents that view security behavior requires attention; the engineer must not create a public view that accidentally bypasses table restrictions.

## 12. Data Retention And Deletion Plan

### 12.1 Retention Principle

The product collects student answer content only for:

1. moderation;
2. temporary selection;
3. temporary scheduled public display;
4. handling safety reports related to that display.

The product does not need a permanent archive of answer content. Deleting response text after the weekly display completes is aligned with data minimization.

### 12.2 Important Storage Correction

Deleting submissions is appropriate for privacy and allows freed database space to be reused. It must not be described as an immediate free-tier quota reset.

Supabase documents:

- Free Plan projects are limited by 500 MB database size.
- PostgreSQL does not immediately reclaim physical space from deleted rows; deleted tuples are reclaimed through vacuum behavior.
- Supabase projects have automatic vacuuming enabled.
- Manual vacuum operations may be used where appropriate; `VACUUM FULL` locks the affected table and is not a routine per-cycle task.

For text-only weekly answers, the storage footprint should be small. The strongest reason to purge is privacy and minimizing retained UGC, not expected weekly storage pressure.

### 12.3 Purge Schedule

The purge eligibility rule is:

- A cycle becomes purge-eligible after its twelfth and final display slot has ended.
- Run purge processing after the final slot, recommended at least fifteen minutes later to avoid timing/race issues.
- For a normal six-day schedule ending at 4:59:59 PM Asia/Manila, a purge check may run after 5:15 PM Asia/Manila.
- Implement purge using a database-side function invoked manually during pilot testing and, once validated, by Supabase Cron.

The scheduled job must determine eligibility from UTC timestamps and state, not from client device clocks.

### 12.4 Content To Delete At Cycle Close

When there are no unresolved reports or safety holds, delete:

- every answer text submission row for the completed cycle, whether rejected, approved, selected or unselected;
- answer-to-slot content references as required to eliminate displayed text;
- resolved report free-text notes, if any were permitted;
- policy acceptance records that include an answer/submission relationship, unless needed only in aggregate.

After deletion, the app must not display past weekly answers.

### 12.5 Limited Data To Retain

Retain only non-content operational records required to operate and demonstrate deletion:

- question text and cycle schedule, unless the administrator also chooses to delete completed questions later;
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

### 12.7 Anonymous Auth User Cleanup

Deleting `weekly_submissions` does not delete Supabase anonymous Auth users.

Supabase documentation states that automatic cleanup of anonymous users is currently unavailable and gives an example of deleting anonymous users older than 30 days. Therefore:

- Add a separate scheduled maintenance procedure for anonymous Auth user cleanup.
- Do not delete an anonymous Auth user that is referenced by an active block or unresolved report until the required control is complete.
- Run this cleanup independently from weekly answer-text purge.

## 13. App Implementation Architecture

### 13.1 New Application Domain

Introduce an isolated domain for this feature, conceptually under:

- a new route screen for Weekly Question;
- new UI components for prompt, submission, display, report and online-state handling;
- a new service module for Supabase operations;
- new types and validation for cycle/display states;
- small local cache support only for non-sensitive currently published display data if offline fallback is adopted.

The implementation must follow existing app architecture conventions after inspecting comparable route and service modules during execution.

### 13.2 App-Side States

The Weekly Question screen must support these states:

| State | UI Behavior |
| --- | --- |
| Offline with no cached public item | Explain that Weekly Question requires internet; offer retry |
| Loading | Loading indicator without assuming a question exists |
| No active cycle | Friendly empty state |
| Submissions open, not submitted | Show prompt, policy notice and answer form |
| Submissions open, already submitted | Show anonymous submission receipt; do not reveal/edit stored body |
| Review period | Explain that answers are being reviewed |
| Display active within a filled slot | Show prompt, anonymous answer and Report control |
| Display active within an empty slot | Show that no response is scheduled for this time |
| Outside display slot during display days | Show next answer availability time |
| Removed answer | Show that the response is unavailable |
| Network/server failure | Preserve the rest of Haki; offer retry for only this feature |

### 13.3 Submission Form

Submission screen requirements:

- Prompt is shown prominently.
- Text input is plain text only.
- Recommended default maximum length is 280 characters.
- Remaining-character count is visible.
- Links are not accepted or are treated as plain text and rejected by moderation policy.
- Student must affirm the policy/publication notice before submitting.
- Submit button is disabled after successful submission.
- The screen does not solicit a name, alias, avatar, program, year level or contact information.

### 13.4 Display Card

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

### 13.5 Offline Handling

This feature is explicitly online-first while Haki remains offline-first overall.

Version one default:

- Do not cache submitted answer text locally after successful upload.
- Do not queue offline submissions.
- If offline, disable submission and display an internet-required message.
- Existing app capabilities must remain usable when Weekly Question cannot connect.

Optional later enhancement:

- Cache the currently displayed public answer for read-only fallback, marked with its last fetched timestamp and potentially-outdated status.

The optional cache is not part of v1 because the feature is time-slot-sensitive and stale public display may confuse users.

## 14. Administrative Operating Procedure

### 14.1 Before A New Cycle

Administrator actions:

1. Create a new cycle in the Supabase Dashboard.
2. Enter a prompt that complies with prompt safety rules.
3. Set submission opening and closing timestamps.
4. Set the first of six display dates.
5. Select `manual` or `random_approved` mode.
6. Verify the publication and privacy notice version.
7. Publish the cycle for student submission.

### 14.2 During Submission Day

Administrator actions:

- Observe submission count and system errors.
- Do not expose pending content in the app.
- Close the cycle early only for a safety incident or system abuse; record the reason outside public content.

### 14.3 During Review

For each submission:

1. Reject content containing identifying details, even if otherwise kind.
2. Reject content naming or describing another identifiable person.
3. Reject harmful, offensive, spam, sexual, illegal, or policy-breaking content.
4. Approve only responses suitable for anonymous public display.
5. Block anonymous author IDs only when behavior warrants future prevention.

### 14.4 Scheduling Display

Manual mode:

- Assign each approved response to an intended slot.
- Inspect all populated slots before activating display.

Random-approved mode:

- Approve safe candidate content first.
- Invoke random assignment for vacant slots only.
- Inspect generated assignments before activating display.

### 14.5 During Display Days

Administrator actions:

- Review reports within a stated operational response window.
- Remove an answer immediately if it exposes personal information or presents an urgent safety concern.
- Mark affected content under hold while resolving reports.

### 14.6 At Cycle Completion

Administrator/system actions:

1. Confirm final display slot has expired.
2. Identify unresolved reports and apply moderation holds.
3. Execute or verify content purge for all other submissions.
4. Resolve held reports and purge held content once no longer required.
5. Confirm aggregate counts and purge-completion timestamp.
6. Periodically clean up anonymous authentication records under the separate maintenance policy.

## 15. Failure Modes And Required Handling

| Failure Mode | Required Behavior |
| --- | --- |
| Student is offline | No submission attempt; explain online requirement |
| Submission upload times out | Do not assume success; re-check submission status before allowing retry |
| Anonymous auth session cannot be established | Disable submission and report temporary error |
| Student submits twice | Database constraint rejects second write; UI shows already submitted |
| Spam wave or automated anonymous users | Close submissions, review rate controls, investigate CAPTCHA/endpoint controls |
| Admin approves fewer than twelve responses | Empty slots display neutral no-response text |
| Random scheduling has fewer than twelve approved candidates | Schedule each eligible answer at most once; leave remainder empty |
| Published answer is reported | Place under hold; allow admin removal; prevent content purge until resolved |
| Purge job fails | Alert administrator through dashboard monitoring; retry safely |
| Purge removes rows but storage metric does not immediately decline | Recognize expected PostgreSQL vacuum behavior; do not create emergency deletion logic |
| Supabase project unavailable or paused | Weekly feature shows unavailable state; local Haki features remain functional |
| Malicious client attempts admin operations | RLS denies operation; no service credentials exist in the app |

## 16. Test Strategy

### 16.1 Unit And Validation Tests

Test:

- question prompt validation;
- answer length and whitespace validation;
- date/slot generation for six days and two slots per day;
- Manila-time to UTC conversion;
- cycle-state presentation logic;
- report reason validation;
- safe display state when a slot is empty, removed, expired or not yet active.

### 16.2 Service Integration Tests

Against a development Supabase project or local Supabase environment, verify:

- an anonymous session can obtain the permitted public cycle data;
- one anonymous user can submit one answer in an open cycle;
- the same identity cannot submit a second answer in that cycle;
- a different anonymous identity can submit its own answer;
- writes fail outside the submission window;
- writes fail for blocked identities;
- student clients cannot select raw submission rows;
- student clients cannot update moderation status;
- student clients cannot create or alter display slots;
- a visible assigned slot returns only its active answer;
- a future, expired or removed slot does not expose answer text;
- a report creates a hold condition;
- purge deletes non-held cycle content and preserves held reported content until resolution.

### 16.3 RLS Adversarial Tests

Use direct client calls with the mobile publishable key to attempt:

- fetching all raw submissions;
- selecting approved-but-not-yet-visible answers;
- approving the submitter's own content;
- setting a submission author ID belonging to another user;
- assigning a submission to a slot;
- reading block records;
- invoking purge;
- bypassing submission limits.

All attempts must fail at the backend regardless of UI behavior.

### 16.4 Administrative Workflow Tests

Verify:

- a cycle can be drafted, opened, reviewed, scheduled, completed and purged;
- manual assignment supports fewer than twelve responses;
- random-approved assignment selects only approved records and does not duplicate answers unless explicitly allowed by later product change;
- removing a live answer immediately prevents future public reads;
- cycles with unresolved reports are only partially purged.

### 16.5 UI Scenario Tests

Test on representative mobile devices:

- new anonymous participant submits once;
- returning participant sees receipt state;
- display card appears only during scheduled interval;
- report flow completes;
- online failure does not block navigation to offline Haki capabilities;
- no Tips & Tricks screen behavior changes;
- no Haki chat or official information behavior changes.

### 16.6 Privacy And Content Review Checks

Before release, manually verify:

- policy is shown before submission;
- no requested input field solicits identity;
- screens clearly label responses as anonymous peer content;
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
- Validate anti-abuse option suitable for Expo.

Exit criteria:

- RLS adversarial tests pass.
- Admin can review/schedule/purge without using app-side admin mode.
- Anonymous sign-in abuse mitigation strategy is confirmed.

### Phase 1: App Read-Only Pilot

Purpose: Verify online screen behavior without accepting live student UGC.

- Add Weekly Question route and public display UI.
- Load administrator-created safe sample responses from backend.
- Test online failure and time-slot presentation.

Exit criteria:

- No regression to offline Haki behavior.
- Scheduled display works in Asia/Manila slots.

### Phase 2: Controlled Submission Pilot

Purpose: Accept real student answers with close moderation.

- Enable anonymous submissions for a limited participant group or controlled announcement.
- Operate manual selection only.
- Monitor submissions, reports and purge results each cycle.

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
4. No student can read raw or non-current approved submissions.
5. No unreviewed submission can be published or randomly selected.
6. Up to twelve slots can be scheduled for six days at two slots per day.
7. Manila-time scheduling is consistently converted and enforced using backend timestamps.
8. Students see a policy/privacy notice before submitting.
9. Students can report visible content in the app.
10. Administrators can remove content and block an abusive anonymous identity.
11. Remote admin operations cannot be authorized by the current local Haki admin PIN.
12. Answer content is purged after the completed display cycle except while under unresolved-report hold.
13. The team understands that deletion makes space reusable but may not instantly reduce Supabase database metrics.
14. Existing offline functionality, Tips content and official campus-answer behavior are unchanged.
15. Platform UGC requirements and Philippine privacy notice requirements have been reviewed before store release.

## 19. Open Product Decisions To Confirm Before Coding

The architecture above establishes safe defaults. The project owner must confirm these presentation decisions before implementation begins:

| Decision | Recommended Default |
| --- | --- |
| Public feature name | `Weekly Question` |
| Home access | New Home card leading to a separate screen |
| Answer character limit | 280 characters |
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

Build Weekly Question as a new, online-only, moderated community feature with Supabase as the version-one backend. Keep the student interaction anonymous in the interface while using anonymous authenticated backend sessions for control and moderation. Use manual dashboard moderation first; permit random display only from approved content. Display two answers per day across six days using Manila-time slots, and purge student answer content after the final display period except where an unresolved report requires temporary retention.

This design preserves Haki's offline-first and official-answer boundaries while delivering the intended lightweight student-sharing experience with a defensible privacy, security and store-compliance foundation.
