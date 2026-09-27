Tagline
Your messy thoughts. Made useful.

Product concept
Context is an intelligent workspace that transforms unstructured thoughts into useful, structured outcomes.

Users can enter:

rough thoughts

voice transcripts

notes

screenshots

copied text

meeting notes

ideas

incomplete sentences

URLs

project context

Context understands the user's intent and transforms the raw input into useful outputs such as:

polished emails

project plans

task lists

meeting summaries

proposals

social posts

decision frameworks

briefs

product requirements

structured notes

The product should feel like a new category of productivity software.

It must NOT look like:

ChatGPT clone

generic AI chatbot

generic SaaS dashboard

Notion clone

generic text editor

generic productivity application

The core experience is:

RAW THOUGHT → UNDERSTANDING → STRUCTURE → FINISHED OUTPUT

This transformation must be visually demonstrated throughout the product.

1. IMPORTANT IMPLEMENTATION CONSTRAINT
Build this as a:

FRONTEND-ONLY PORTFOLIO DEMO

Do NOT create a backend.

Do NOT require:

database

authentication server

API keys

OpenAI API

external AI services

external backend

real voice processing

Use realistic mock data and deterministic simulated AI behavior.

The product must feel real even though the intelligence is simulated.

Create reusable mock data and state transitions to simulate:

processing

understanding

generation

saving

exporting

voice transcription

AI suggestions

Do not make fake network calls unnecessarily.

2. PRIMARY GOAL
The goal is not to build the largest number of features.

The goal is to create an experience where a visitor immediately thinks:

"This is an exceptionally well-designed product."

The first 10 seconds are critical.

A visitor should understand:

What Context does.

Why it is useful.

How the transformation works.

That the designer/developer understands sophisticated product UX.

The product should be strong enough to use as a flagship portfolio project on Contra.

3. DESIGN QUALITY BAR
Use the product-quality principles of premium products such as:

Linear

Raycast

Vercel

Stripe

Arc

Superhuman

modern AI-native products

Do NOT copy their visual design.

Create an original visual language.

The experience should feel:

calm

intelligent

premium

editorial

minimal

human

futuristic without being gimmicky

fast

intentional

Avoid:

excessive glassmorphism

excessive neon

giant gradients

meaningless 3D

random floating blobs

excessive rounded cards

generic AI sparkle icons everywhere

stock illustrations

unnecessary shadows

dashboard-card overload

The visual message should be:

"This product thinks clearly."

4. CORE DESIGN CONCEPT
The entire application is based around one visual metaphor:

Thought → Structure
Raw information should look slightly chaotic.

Structured information should become calm, aligned and organized.

Example:

RAW:

"I need to tell Sarah that we're probably going to miss Friday because the API isn't ready and maybe Monday but don't promise Monday yet..."

Then Context visually extracts:

INTENT
Client update

CONTEXT
Project delivery

TONE
Professional

ACTION
Communicate revised timeline

Then produces:

EMAIL

Hi Sarah,

Quick update — we're currently working through the remaining API integration and may need to move the Friday delivery.

I'll confirm the revised timeline by Thursday once the remaining work is complete.

Thanks,
Mahek

This transformation should be the visual identity of the product.

5. BRAND
Name:

CONTEXT

Logo:

Create a minimal abstract mark representing:

context
connection
transformation

The logo should work as:

favicon

app icon

navigation logo

mobile icon

Use a simple geometric form.

Do not create a complicated logo.

6. COLOR SYSTEM
Primary visual direction:

Warm minimalism.

Base:

Off-white
Warm white
Graphite
Soft gray

Primary accent:

Deep violet / electric indigo

Secondary accent:

Soft blue

Success:

Emerald

Warning:

Amber

Error:

Coral/red

Use color sparingly.

The majority of the interface should remain neutral.

AI-related interactions may use a subtle violet/blue accent.

Do not make the entire interface purple.

7. DARK MODE
Provide a premium dark mode.

Dark background:

Near-black graphite.

Surface:

Dark gray.

Borders:

Subtle gray.

Text:

Warm white.

Secondary text:

Muted gray.

Accent:

Electric violet/indigo.

Dark mode should feel sophisticated rather than cyberpunk.

8. TYPOGRAPHY
Use:

Inter

or another premium modern UI font.

Use a refined typography scale.

Landing hero:

Large expressive typography.

Application:

Compact professional typography.

Use monospace for:

metadata

shortcuts

technical values

timestamps

Typography should provide most of the visual hierarchy.

9. DESIGN TOKENS
Create centralized design tokens for:

colors
spacing
font sizes
line heights
radii
shadows
transitions
z-index

Use an 8px spacing system with smaller 4px subdivisions.

Do not scatter random values throughout components.

10. WEBSITE STRUCTURE
Create:

Landing Page

Product Demo

App Workspace

Thought Editor

Transform Experience

Output Workspace

History

Templates

Settings

Mobile experience

11. LANDING PAGE
The landing page must be highly interactive.

Do NOT make a conventional marketing page with:

Hero
Features
Pricing
Testimonials
Footer

Instead, make the PRODUCT DEMO the hero.

Hero headline:

Your messy thoughts.
Made useful.
Subheading:

"Capture whatever is in your head. Context turns it into something you can actually use."

Primary CTA:

Try Context

Secondary:

Watch it transform

12. HERO INTERACTION
The hero should contain an interactive transformation.

Start with:

"Try typing something messy..."

Input:

"I need to tell Sarah about the project delay..."

As the demo runs, show:

RAW THOUGHT

↓

UNDERSTANDING

↓

OUTPUT

The raw text should visually transform.

Do not instantly replace the text.

Use a staged transformation.

Example:

Step 1:

Raw text appears.

Step 2:

Important concepts subtly highlight.

Step 3:

Intent appears.

Step 4:

Structure appears.

Step 5:

Final output appears.

The visitor should feel like they are watching intelligence happen.

13. HERO DEMO STATES
Create multiple demo presets.

Preset 1:

Email

Preset 2:

Project plan

Preset 3:

Meeting summary

Preset 4:

Decision

Preset 5:

Social post

User can click each.

The demo content changes.

Animate transitions smoothly.

14. NAVIGATION
Marketing navigation:

Logo
Product
How it works
Templates
Pricing
Sign in
Try Context

Keep navigation minimal.

Sticky navigation.

On scroll:

slightly reduce height.

Use subtle background blur.

15. HOW IT WORKS
Create a visual storytelling section:

Capture
Anything goes.

↓

Understand
Context identifies intent.

↓

Structure
Ideas become organized.

↓

Create
Get something ready to use.

Use animated transitions between each state.

16. THE "MESSY TO CLEAR" SHOWCASE
This should be one of the most impressive sections.

Left:

messy input.

Right:

structured result.

As the user scrolls, elements rearrange.

Example:

MESSY:

"I have three things I need to do..."

↓

Context extracts:

TASKS

Finish proposal

Call client

Send invoice

The visual transformation should be smooth.

17. PRODUCT DEMO
Create a dedicated demo environment.

URL concept:

/demo

Interface:

Left:

Input

Center:

Understanding

Right:

Output

Desktop:

┌──────────────┬────────────────┬─────────────────┐
│ YOUR THOUGHT │ CONTEXT │ RESULT │
│ │ │ │
│ Raw input │ Intent │ Final output │
│ │ Context │ │
│ │ Tone │ │
└──────────────┴────────────────┴─────────────────┘

Allow panels to collapse.

18. APP WORKSPACE
The main app should have:

Sidebar
Main workspace
Optional context panel

Sidebar:

Inbox
Workspace
Drafts
History
Templates
Collections

Bottom:

Settings
Keyboard shortcuts
Profile

Make sidebar collapsible.

19. INBOX
Inbox is where raw thoughts arrive.

Display:

Today

"Need to follow up with Sarah..."
"Launch post idea..."
"Things to fix before Friday..."
"Meeting notes..."

Each item displays:

timestamp
source
status

Sources:

Voice
Text
Screenshot
Import

20. THOUGHT CARD
Thought cards should be minimal.

Example:

"Need to send the proposal to Alex..."

2 minutes ago
Voice

[Transform]

Hover:

Reveal:

Transform
Edit
Archive

Do not overload the card.

21. THOUGHT EDITOR
Click a thought.

Open a focused editor.

Large text area.

At bottom:

Transform into:

Email
Plan
Tasks
Summary
Brief
Post
Decision

The transformation options should feel like contextual actions, not generic dropdowns.

22. VOICE EXPERIENCE
Create a beautiful voice interaction simulation.

Button:

Hold to speak

When active:

A subtle waveform appears.

Use:

audio bars
soft pulsing
live transcript

Example:

Listening...

"Okay, so I need to..."

Then:

Transcript complete.

Do not pretend actual audio processing exists.

Use simulated transcript states.

23. VOICE UI
The voice interaction should feel premium.

Initial:

🎙

Hold to speak

Active:

Listening
● ● ● ● ●

Processing:

Understanding...

Complete:

Transcript ready

Respect reduced motion.

24. SCREENSHOT INPUT
Allow users to simulate dropping a screenshot.

Create drag-and-drop zone.

When an image is dropped:

Analyzing image...

Then show:

Detected:

Interface
Text
Buttons
Navigation

Generate a simulated UX summary.

25. CONTEXT PANEL
The context panel is one of the key product features.

When analyzing content, show:

Intent
People
Dates
Tasks
Topics
Tone

Example:

INTENT

Client update

PEOPLE

Sarah

PROJECT

Website redesign

DEADLINE

Friday

TONE

Professional

These should animate into place.

26. TRANSFORMATION EXPERIENCE
This is the signature product experience.

When user clicks:

"Create email"

show:

Stage 1:

Understanding your thought...

Stage 2:

Identifying intent...

Stage 3:

Structuring message...

Stage 4:

Writing draft...

Stage 5:

Ready.

Keep duration around 1–2 seconds.

Never make users wait unnecessarily.

27. OUTPUT EDITOR
Output should be editable.

Example:

EMAIL

Subject:
Project timeline update

Body:

Hi Sarah,

Quick update...

Toolbar:

Bold
Italic
Lists
Link
Undo
Redo

Actions:

Copy
Export
Save
Share

28. OUTPUT TRANSFORMATION
Allow changing the output.

Example:

Email

↓

Shorter

↓

More confident

↓

More casual

↓

Turn into Slack message

↓

Turn into task list

This should feel instantaneous.

29. OUTPUT ACTIONS
At the bottom:

Copy
Export
Save
Share

Then secondary actions:

Make shorter
Make clearer
Change tone
Change format

30. TONE CONTROL
Create a visual tone selector.

Options:

Professional
Friendly
Concise
Confident
Casual
Persuasive

When selecting a tone:

show subtle preview changes.

Use segmented controls or a horizontal selector.

31. TRANSFORM COMMANDS
Create quick commands:

/email
/plan
/summary
/tasks
/brief
/post
/decision

Keyboard:

CMD/CTRL + Enter

Run transformation.

32. COMMAND PALETTE
Implement:

CMD/CTRL + K

Commands:

New thought
Transform
Search
Open history
Create template
Change tone
Toggle theme
Open settings

Use keyboard navigation.

33. SEARCH
Global search across:

thoughts
outputs
templates
collections

Example:

Search:

"Sarah"

Results:

3 thoughts
2 emails
1 project

Use highlighted matches.

34. HISTORY
History should show transformation timeline.

Example:

10:42

Raw thought

↓

10:42

Email created

↓

10:43

Tone changed to confident

↓

10:44

Copied

Make this visual rather than a generic table.

35. TEMPLATES
Create templates:

Client email
Meeting summary
Project brief
Proposal
Social post
Launch plan
Follow-up
Decision memo

Each template should have:

title
description
example
use button

36. TEMPLATE EXPERIENCE
Click:

Client Update

Then show:

Input requirements:

Context
Current status
Timeline
Tone

Generate.

This should demonstrate product thinking.

37. COLLECTIONS
Allow users to organize outputs.

Examples:

Client Work
Startup
Personal
Ideas
Content

Create beautiful collection views.

38. MOBILE APP EXPERIENCE
Treat mobile as a first-class product.

Do not simply collapse desktop.

Mobile home:

CONTEXT

Good morning.

What are you thinking?

Large microphone button.

Below:

Recent thoughts.

Navigation:

Home
Inbox
Create
History
Settings

39. MOBILE CAPTURE
The main mobile action should be:

Hold to speak.

Use a large thumb-friendly interaction.

When active:

large waveform
live transcript
cancel
done

After capture:

show transformation suggestions.

40. MOBILE TRANSFORMATION
Example:

User speaks.

↓

Transcript.

↓

Bottom sheet:

What should I make?

Email
Tasks
Summary
Plan
Note

Select:

Email.

Output opens in a clean editor.

41. RESPONSIVE DESIGN
Support:

375px
390px
430px
768px
1024px
1280px
1440px
1920px

Do not simply scale.

Desktop:

three-panel workspace.

Tablet:

two-panel.

Mobile:

single-panel with bottom sheets.

42. MOTION DESIGN SYSTEM
Motion is important but must remain restrained.

Micro interactions:

120–180ms

Normal transitions:

180–300ms

Major transformations:

300–500ms

Use smooth easing.

Avoid:

bouncy animations
constant movement
excessive parallax
large spring effects

Motion must communicate:

transformation

hierarchy

state

progress

continuity

43. SIGNATURE "THOUGHT TRANSFORMATION" ANIMATION
Create a unique animation.

Raw text:

"Need to talk to Sarah about Friday..."

Words subtly separate into concepts:

Sarah
Friday
Project
Delay

These concepts move into:

Intent
Person
Date
Topic

Then reform into the final message.

This animation is the visual signature of Context.

44. PAGE TRANSITIONS
Use shared-element-like transitions where appropriate.

For example:

Thought card
→
Thought editor

Output preview
→
Full editor

Template
→
Transformation screen

Keep transitions fast.

45. SCROLL STORYTELLING
Marketing pages should use scroll storytelling.

As the user scrolls:

RAW
↓

UNDERSTAND
↓

STRUCTURE
↓

CREATE

The visual content should remain anchored while text changes.

Do not overuse sticky sections.

46. HOVER INTERACTIONS
Buttons:

subtle color change

Cards:

slight border emphasis

Navigation:

active indicator

Product demo:

highlight relevant transformation

Do not make elements jump.

47. LOADING STATES
Create meaningful states.

Instead of:

Loading...

Use:

Listening...
Understanding...
Organizing...
Writing...
Ready.

Use skeletons where appropriate.

48. EMPTY STATES
Examples:

No thoughts yet.

"Capture something and Context will help you turn it into something useful."

CTA:

Start a thought

49. ERROR STATES
Errors must be friendly.

Example:

"Something interrupted the transformation."

Actions:

Try again

Edit thought

Never show raw technical errors in the normal UI.

50. TOASTS
Examples:

✓ Copied to clipboard

✓ Saved to collection

✓ Template created

✓ Export ready

Keep notifications subtle.

51. ACCESSIBILITY
Target WCAG 2.2 AA.

Implement:

semantic HTML
keyboard navigation
focus states
ARIA labels
accessible dialogs
accessible dropdowns
sufficient contrast
screen-reader-friendly controls

Respect:

prefers-reduced-motion

When reduced motion is enabled:

remove decorative motion
retain essential state transitions

52. KEYBOARD UX
Support:

CMD/CTRL + K
Command palette

CMD/CTRL + Enter
Transform

N
New thought

/
Focus search

ESC
Close panel

CMD/CTRL + S
Save

Provide shortcut hints.

53. DESIGN SYSTEM
Build reusable components:

Button
IconButton
Input
Textarea
Select
Dropdown
CommandPalette
Dialog
Drawer
Toast
Badge
Avatar
Tooltip
Tabs
SegmentedControl
ThoughtCard
ContextChip
TransformationCard
OutputEditor
VoiceButton
Waveform
Timeline
TemplateCard
CollectionCard
EmptyState
Skeleton
StatusIndicator

All components must have appropriate:

default
hover
active
focus
disabled
loading
error
success

states.

54. ICONOGRAPHY
Use one consistent icon library.

Do not mix random icon styles.

Icons should be:

minimal
technical
consistent
accessible

Do not use emoji as the primary interface iconography.

55. MOCK DATA
Create realistic demo content.

Thoughts:

"Need to follow up with Sarah about the proposal..."

"I want to launch my portfolio next month..."

"Things we need to fix before Friday..."

"Turn these meeting notes into tasks..."

"Should we use PostgreSQL or MongoDB?"

Templates:

Client Update
Meeting Summary
Launch Plan
Decision Memo
Project Brief
Proposal
Social Post

Outputs must be believable and professionally written.

56. DEMO MODE
Create a "Try demo" experience that requires no signup.

Visitors should be able to click:

Try the demo

Then immediately interact.

Provide 4 example thoughts.

Do not put a signup wall before the core experience.

This is critical for portfolio conversion.

57. PORTFOLIO MODE
Create a subtle demo indicator:

DEMO MODE

Do not make it visually distracting.

Allow the visitor to reset the demo.

Button:

Reset demo

58. MARKETING SECTIONS
Landing page should contain:

Hero
Interactive transformation
How it works
Use cases
Voice experience
Screenshot understanding
Output transformations
Web + mobile experience
Templates
Final CTA

Do not create generic testimonial sections with fake people.

Do not create fake customer logos.

Do not create fake metrics such as:

"10 million users"

unless explicitly labeled as fictional demo content.

59. PRICING
If pricing is included, clearly treat it as demo content.

Example:

Free
Pro
Team

Keep pricing secondary to the product experience.

60. FOOTER
Minimal.

Context logo.

Product
Templates
Demo
About

Legal

Social links can be placeholders.

61. PRODUCT COPY
Use concise, confident language.

Avoid generic AI marketing phrases such as:

"Unlock the power of AI."

"Revolutionize your productivity."

"Supercharge your workflow."

Instead use specific language.

Examples:

"Start with whatever is in your head."

"Context finds the shape inside it."

"From rough thought to ready-to-use."

"Don't organize first. Just think."

"Capture now. Structure later."

62. VISUAL DETAILS
Pay attention to:

1px borders

subtle background changes

precise spacing

typographic rhythm

button height

input height

icon alignment

line height

text contrast

hover states

focus states

selection states

loading states

Do not rely on shadows to create hierarchy.

Use whitespace first.

63. PERFORMANCE
Keep the frontend fast.

Use:

lazy loading
memoization where useful
efficient state management
optimized animations
code splitting
compressed assets
minimal dependencies

Avoid unnecessary rendering.

Do not load large libraries when a small implementation is sufficient.

64. TECH STACK
Use:

React
TypeScript
Vite or Next.js

Tailwind CSS

Framer Motion / Motion

Lucide icons

Use a lightweight state-management solution if needed.

No backend.

No database.

No authentication server.

All demo data should be local.

65. PROJECT ARCHITECTURE
Use a clean structure such as:

src/

components/
features/
pages/
layouts/
hooks/
data/
lib/
utils/
animations/
styles/

Separate product features from generic UI components.

Avoid giant components.

Avoid duplicated markup.

Use TypeScript types throughout.

66. STATE ARCHITECTURE
Implement realistic states:

idle
capturing
processing
understanding
ready
editing
saved
error

Do not use arbitrary timeouts everywhere.

Create reusable simulated transformation functions.

67. SIMULATED AI ENGINE
Create a local deterministic mock AI layer.

Example:

transformThought(thought, outputType, tone)

Returns:

intent
entities
topics
tone
output
suggestions

Use predefined responses for demo inputs.

For unknown input, generate a sensible fallback using local rules/templates.

The UI should never break because the user entered unexpected text.

68. REAL-TIME FEEDBACK
When user edits the thought:

Update:

character count

context chips

suggested transformations

When changing tone:

update preview.

When changing output type:

update generated result.

Keep the experience responsive.

69. DESKTOP LAYOUT QUALITY
At 1440px:

The interface should not stretch content excessively.

Use a controlled max-width.

Maintain comfortable reading width.

Use side panels intelligently.

Avoid huge empty spaces.

70. MOBILE QUALITY
At 375px:

Everything must remain accessible.

Touch targets:

minimum approximately 44px.

Bottom navigation should remain reachable.

Dialogs should become bottom sheets when appropriate.

Keyboard opening should not destroy the layout.

71. VISUAL QA
After implementation, inspect every major route.

Check:

Landing
Demo
Workspace
Editor
Transform
Output
History
Templates
Settings
Mobile

For each:

Check spacing.

Check typography.

Check alignment.

Check contrast.

Check motion.

Check hover.

Check focus.

Check loading.

Check empty states.

Check responsive layout.

Fix inconsistencies.

72. FINAL DESIGN QA
Ask:

Does this look like a generic AI wrapper?

If yes:

REDESIGN.

Does the landing page explain the product without paragraphs?

If no:

REDESIGN.

Does the transformation feel magical?

If no:

REDESIGN.

Does mobile feel intentionally designed?

If no:

REDESIGN.

Does the product feel calm and premium?

If no:

REDESIGN.

Does every animation communicate something?

If no:

REMOVE IT.

73. MOST IMPORTANT EXPERIENCE
The strongest flow must be:

LANDING

↓

Try Demo

↓

Enter messy thought

↓

Understanding animation

↓

Context extraction

↓

Output generation

↓

Edit output

↓

Change tone

↓

Copy

↓

Try another transformation

This should require no login.

The visitor should be able to experience the product within 30 seconds.

74. FINAL QUALITY BAR
Do not optimize for number of screens.

Optimize for:

clarity + interaction quality + visual polish + emotional response.

The final experience should make a designer think:

"This is beautifully designed."

A frontend engineer think:

"The interaction architecture is sophisticated."

A startup founder think:

"I could turn this into a real product."

A potential client think:

"This person can build polished products, not just code screens."

The final product must feel like a real premium product—not a portfolio mockup.

Build it with obsessive attention to:

PRODUCT UX
VISUAL DESIGN
MOTION
RESPONSIVENESS
ACCESSIBILITY
MICRO-INTERACTIONS
TYPOGRAPHY
SPACING
STATE DESIGN
INTERACTION QUALITY

The final result should be:

minimal, intelligent, tactile, fast, memorable and commercially believable.

One important instruction for Qwen
After pasting the prompt, tell Qwen not to implement everything in one giant generation pass. Have it build in this order:

Design system + app shell

Landing page + hero transformation

Core thought workspace

Transformation engine + output editor

Voice/screenshot simulated experiences

History/templates

Mobile experience

Motion polish

Accessibility

Final visual QA

That usually produces a much more coherent result than asking it to generate 70 sections simultaneously.



