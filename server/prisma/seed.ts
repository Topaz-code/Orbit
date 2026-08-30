/**
 * Orbit demo data seeder.
 *
 * Produces a small but fully connected social graph so the app looks alive the moment you sign
 * in: 8 users, ~20 posts with media/links/threads, stories, DMs, group chats, groups, friendships,
 * notifications and call history.
 *
 * All media is generated locally as SVG (see utils/placeholder.ts) — no DiceBear, no picsum, no
 * network access required.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PRIVACY } from '../src/services/serialize.js';
import { inviteCode, seededRandom } from '../src/utils/helpers.js';
import { generateAvatar, generateCover, generatePhoto } from '../src/utils/placeholder.js';
import { ensureUploadDirs } from '../src/config/paths.js';

const DEMO_PASSWORD = 'orbit123';
const random = seededRandom('orbit-seed-v1');

const minutes = (n: number) => n * 60 * 1000;
const hours = (n: number) => n * 60 * minutes(1);
const days = (n: number) => n * 24 * hours(1);
const ago = (ms: number) => new Date(Date.now() - ms);

interface SeedUser {
  username: string;
  displayName: string;
  bio: string;
  phone: string;
  email: string;
}

const USERS: SeedUser[] = [
  { username: 'alexchen', displayName: 'Alex Chen', bio: 'Photography enthusiast 📸 | Coffee addict ☕', phone: '+15550100', email: 'alex@orbit.local' },
  { username: 'sarahj', displayName: 'Sarah Johnson', bio: 'Reading, coding, and hiking 🏔️', phone: '+15550101', email: 'sarah@orbit.local' },
  { username: 'mikeross', displayName: 'Mike Ross', bio: 'Law student by day, gamer by night 🎮', phone: '+15550102', email: 'mike@orbit.local' },
  { username: 'emilyw', displayName: 'Emily Williams', bio: 'Artist & designer | Creating beauty daily 🎨', phone: '+15550103', email: 'emily@orbit.local' },
  { username: 'jasonk', displayName: 'Jason Kumar', bio: 'Startup founder | Building cool things 🚀', phone: '+15550104', email: 'jason@orbit.local' },
  { username: 'lisapark', displayName: 'Lisa Park', bio: 'Music is life 🎵 | Piano & guitar', phone: '+15550105', email: 'lisa@orbit.local' },
  { username: 'davidm', displayName: 'David Martinez', bio: 'Sports fanatic ⚽ | Gym rat 💪', phone: '+15550106', email: 'david@orbit.local' },
  { username: 'rachelg', displayName: 'Rachel Green', bio: 'Fashion, food, and fun ✨', phone: '+15550107', email: 'rachel@orbit.local' },
];

interface SeedPost {
  author: string;
  text: string;
  minutesAgo: number;
  photos?: string[];
  link?: { url: string; title: string; description: string; siteName: string };
  visibility?: 'public' | 'friends' | 'private';
  comments?: Array<{ author: string; text: string; replies?: Array<{ author: string; text: string }> }>;
}

const POSTS: SeedPost[] = [
  {
    author: 'alexchen',
    text: 'Golden hour on the rooftop tonight. Three years of shooting and I still get excited when the light does this. #photography #goldenhour',
    minutesAgo: 24,
    photos: ['Golden hour, rooftop', 'City skyline at dusk'],
    comments: [
      { author: 'emilyw', text: 'The colours in the second one are unreal 😍', replies: [{ author: 'alexchen', text: 'Thank you! Straight out of camera, no edits.' }] },
      { author: 'lisapark', text: 'Teach me your ways' },
    ],
  },
  {
    author: 'sarahj',
    text: 'Finally shipped my first open-source PR and it got merged 🎉 Turns out the scariest part was clicking submit. If you have been sitting on a contribution — just send it. #coding',
    minutesAgo: 68,
    comments: [
      { author: 'jasonk', text: 'Huge! What project?' , replies: [{ author: 'sarahj', text: 'A little CLI tool for markdown linting. Small but mine 😄' }] },
      { author: 'mikeross', text: 'Congrats Sarah!' },
    ],
  },
  {
    author: 'mikeross',
    text: 'Contracts final in 14 hours and I am currently learning that caffeine has a ceiling. Send help (and notes).',
    minutesAgo: 95,
    comments: [{ author: 'davidm', text: 'You got this man 💪' }],
  },
  {
    author: 'emilyw',
    text: 'New piece finished. Twelve layers, four false starts, one very patient cat. Swipe for the detail shots.',
    minutesAgo: 140,
    photos: ['Layered abstract, teal', 'Detail: brush texture', 'Detail: colour field'],
    comments: [
      { author: 'rachelg', text: 'This would look incredible as a print' },
      { author: 'alexchen', text: 'The texture in the third shot 🔥' },
    ],
  },
  {
    author: 'jasonk',
    text: 'Reminder that the algorithm-free feed is not a feature, it is the whole point. You should see what your friends posted — not what keeps you scrolling.',
    minutesAgo: 180,
    comments: [
      { author: 'sarahj', text: 'This is why I moved my whole group chat here' },
      { author: 'lisapark', text: 'Preach 👏' },
    ],
  },
  {
    author: 'lisapark',
    text: 'Learned the entire Clair de Lune intro today. My neighbours have opinions. 🎹',
    minutesAgo: 220,
    comments: [{ author: 'emilyw', text: 'Post a clip!!' }],
  },
  {
    author: 'davidm',
    text: 'Leg day complete. Stairs are now my enemy. Week 6 of the challenge and down 4kg 💪 #fitness',
    minutesAgo: 260,
    photos: ['Gym, morning light'],
    comments: [{ author: 'mikeross', text: 'Beast mode' }],
  },
  {
    author: 'rachelg',
    text: 'Made brown butter chocolate chip cookies from scratch and I am never buying store bought again. Recipe in the comments if anyone wants it.',
    minutesAgo: 300,
    photos: ['Cookies, cooling rack'],
    comments: [
      { author: 'sarahj', text: 'YES please' },
      { author: 'rachelg', text: '230g brown butter, 2 eggs, 300g flour, 200g dark choc, sea salt on top. Chill the dough 24h — non negotiable.' },
    ],
  },
  {
    author: 'alexchen',
    text: 'Unpopular opinion: the best camera really is the one you have. Shot this on a five year old phone.',
    minutesAgo: 380,
    photos: ['Street, rainy reflection'],
  },
  {
    author: 'sarahj',
    text: 'Reading "The Pragmatic Programmer" again. The chapter on orthogonality hits different once you have maintained your own bad code for a year.',
    minutesAgo: 460,
    link: {
      url: 'https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition/',
      title: 'The Pragmatic Programmer, 20th Anniversary Edition',
      description: 'The classic guide to software craftsmanship, fully revised for the modern developer.',
      siteName: 'pragprog.com',
    },
  },
  {
    author: 'jasonk',
    text: 'Self-hosting everything this year. Notes, photos, chat. It is more work but nobody gets to A/B test my attention span.',
    minutesAgo: 540,
    comments: [{ author: 'davidm', text: 'What are you running it all on?', replies: [{ author: 'jasonk', text: 'An old ThinkPad in a cupboard. Genuinely.' }] }],
  },
  {
    author: 'emilyw',
    text: 'Colour study of the week: what happens when you only allow yourself three pigments.',
    minutesAgo: 620,
    photos: ['Three pigment study'],
  },
  {
    author: 'lisapark',
    text: 'Playlist for late-night studying, no lyrics, no ads, no tracking. Just piano. Link below.',
    minutesAgo: 700,
    link: {
      url: 'https://musopen.org/music/',
      title: 'Musopen — Free public domain sheet music and recordings',
      description: 'Royalty-free classical recordings, sheet music and textbooks in the public domain.',
      siteName: 'musopen.org',
    },
  },
  {
    author: 'mikeross',
    text: 'Ranked up last night at 2am which I am counting as a legal victory. 🎮',
    minutesAgo: 780,
  },
  {
    author: 'davidm',
    text: 'Sunday five-a-side. We lost 6-2 but I scored a worldie so I am calling it a draw.',
    minutesAgo: 900,
    photos: ['Pitch at sunset'],
    comments: [{ author: 'jasonk', text: 'Footage or it did not happen' }],
  },
  {
    author: 'rachelg',
    text: 'Thrifted an entire outfit for less than a coffee and a pastry. Sustainable AND smug. ✨',
    minutesAgo: 1020,
    photos: ['Thrift haul, flat lay'],
  },
  {
    author: 'alexchen',
    text: 'Friends only: printing a small run of the harbour series. If you want one at cost, tell me before Friday.',
    minutesAgo: 1140,
    visibility: 'friends',
    comments: [{ author: 'emilyw', text: 'Me me me' }],
  },
  {
    author: 'sarahj',
    text: 'Hot take: chronological feeds make you a better friend. You actually see the person who posts twice a year. #privacy',
    minutesAgo: 1300,
    comments: [{ author: 'rachelg', text: 'Genuinely true' }, { author: 'jasonk', text: 'The whole thesis of this place' }],
  },
  {
    author: 'jasonk',
    text: 'Shipping beats perfect. Version one of anything is meant to be a little embarrassing. #startup',
    minutesAgo: 1500,
  },
  {
    author: 'emilyw',
    text: 'Studio reorganised, brushes actually clean, everything labelled. This will last approximately four days.',
    minutesAgo: 1700,
    photos: ['Studio, tidy for once'],
  },
];

const STORIES: Array<{ author: string; label: string; caption: string; hoursAgo: number }> = [
  { author: 'alexchen', label: 'Morning shoot', caption: 'Up at 5. Worth it.', hoursAgo: 2 },
  { author: 'emilyw', label: 'Work in progress', caption: 'Layer 8 of ???', hoursAgo: 4 },
  { author: 'lisapark', label: 'Practice room', caption: 'Two hours in 🎹', hoursAgo: 6 },
  { author: 'davidm', label: 'Leg day', caption: 'Never skip it', hoursAgo: 8 },
  { author: 'rachelg', label: 'Brunch', caption: 'Worth the queue', hoursAgo: 11 },
  { author: 'sarahj', label: 'Trail run', caption: '10k before work', hoursAgo: 14 },
];

const DM_THREADS: Array<{ a: string; b: string; messages: Array<[string, string, number]> }> = [
  {
    a: 'alexchen',
    b: 'sarahj',
    messages: [
      ['sarahj', 'Hey! Did you get the shots from Saturday?', 720],
      ['alexchen', 'Yep, editing them now. There are like 400 😅', 715],
      ['sarahj', 'FOUR HUNDRED', 713],
      ['alexchen', 'I got excited ok', 712],
      ['sarahj', 'Send the best ten and I will pick', 700],
      ['alexchen', 'Deal. Give me tonight', 698],
      ['sarahj', 'Perfect. Also are you coming Thursday?', 400],
      ['alexchen', 'Wouldn’t miss it. What time?', 395],
      ['sarahj', '7ish at the usual place', 390],
      ['alexchen', 'See you then ✌️', 388],
      ['sarahj', 'Bring the camera!', 40],
      ['alexchen', 'Obviously 📸', 35],
    ],
  },
  {
    a: 'alexchen',
    b: 'jasonk',
    messages: [
      ['jasonk', 'Did you actually self-host the whole thing?', 600],
      ['alexchen', 'Every bit. Runs off the laptop in the corner', 596],
      ['jasonk', 'And chat is real-time? No firebase?', 594],
      ['alexchen', 'MQTT broker built into the server. Zero external services', 590],
      ['jasonk', 'Ok that is genuinely impressive', 588],
      ['jasonk', 'What happens when the laptop sleeps 😂', 585],
      ['alexchen', 'Then everyone touches grass. Feature not bug', 580],
      ['jasonk', 'Ship it', 578],
      ['jasonk', 'Send me the repo when you can', 120],
      ['alexchen', 'Will do tonight', 115],
    ],
  },
  {
    a: 'alexchen',
    b: 'emilyw',
    messages: [
      ['emilyw', 'Can I use one of your harbour shots as a painting reference?', 480],
      ['alexchen', 'Of course! Which one', 470],
      ['emilyw', 'The foggy one with the crane', 468],
      ['alexchen', 'Great choice. Sending the full res now', 465],
      ['emilyw', 'You are the best 🎨', 460],
      ['emilyw', 'Will credit you obviously', 458],
      ['alexchen', 'Just show me when it is done', 455],
      ['emilyw', 'Deal 🤝', 450],
      ['emilyw', 'Started it. Already fighting the sky', 90],
      ['alexchen', 'The sky always wins', 85],
    ],
  },
  {
    a: 'alexchen',
    b: 'rachelg',
    messages: [
      ['rachelg', 'COOKIE UPDATE', 300],
      ['rachelg', 'I chilled the dough 36 hours instead of 24', 299],
      ['alexchen', 'And?', 295],
      ['rachelg', 'Transcendent. Life changing. I need to lie down', 294],
      ['alexchen', 'Saving me one?', 290],
      ['rachelg', 'There are four left and I am weak. No promises', 288],
      ['alexchen', '😂', 285],
      ['rachelg', 'Ok two are yours. Come get them', 60],
    ],
  },
];

const GROUPS: Array<{
  name: string;
  description: string;
  privacy: 'public' | 'private';
  owner: string;
  members: string[];
  posts: Array<{ author: string; text: string; minutesAgo: number; photo?: string }>;
  chat: Array<[string, string, number]>;
}> = [
  {
    name: 'Photography Club',
    description: 'Weekly photo walks, gear talk, and honest critique. All skill levels welcome.',
    privacy: 'public',
    owner: 'alexchen',
    members: ['alexchen', 'emilyw', 'sarahj', 'rachelg', 'lisapark'],
    posts: [
      { author: 'alexchen', text: 'Photo walk this Saturday, 6am at the harbour. Bring a wide lens and warm clothes.', minutesAgo: 120, photo: 'Harbour, first light' },
      { author: 'emilyw', text: 'Critique thread: be brutal, I can take it.', minutesAgo: 300, photo: 'Portrait study' },
      { author: 'rachelg', text: 'Is anyone else completely lost on manual mode or is it just me', minutesAgo: 620 },
    ],
    chat: [
      ['alexchen', 'Saturday still on for everyone?', 200],
      ['emilyw', 'In!', 198],
      ['rachelg', 'Yes but 6am is a crime', 196],
      ['sarahj', 'Seconded. See you all there anyway', 190],
      ['lisapark', 'I will bring coffee for the group', 185],
      ['alexchen', 'And that is why Lisa is the favourite', 180],
    ],
  },
  {
    name: 'Study Group CS101',
    description: 'Problem sets, past papers, and moral support. Finals are coming.',
    privacy: 'private',
    owner: 'sarahj',
    members: ['sarahj', 'mikeross', 'jasonk', 'davidm'],
    posts: [
      { author: 'sarahj', text: 'Uploaded my notes for weeks 1-6. Shout if anything is unclear.', minutesAgo: 240 },
      { author: 'mikeross', text: 'Does anyone actually understand big-O or are we all pretending', minutesAgo: 500 },
    ],
    chat: [
      ['sarahj', 'Study session tonight?', 150],
      ['mikeross', 'Please. I am drowning', 148],
      ['jasonk', 'I can do 8pm', 145],
      ['davidm', 'Same. Library?', 140],
      ['sarahj', 'Library, third floor. Bring snacks', 138],
    ],
  },
  {
    name: 'Fitness Challenge',
    description: '12 weeks, consistent effort, zero judgement. Post your progress.',
    privacy: 'public',
    owner: 'davidm',
    members: ['davidm', 'mikeross', 'jasonk', 'rachelg', 'lisapark', 'alexchen'],
    posts: [
      { author: 'davidm', text: 'Week 6 check-in. Post your numbers, no excuses, no shame.', minutesAgo: 180 },
      { author: 'rachelg', text: 'Ran 5k without stopping for the first time ever 🎉', minutesAgo: 420 },
    ],
    chat: [
      ['davidm', 'Week 6 check in — how is everyone doing', 100],
      ['rachelg', '5k unbroken! Still buzzing', 98],
      ['mikeross', 'Down 2kg, up 1 existential crisis', 95],
      ['jasonk', 'Consistency is the hard part honestly', 92],
      ['davidm', 'That is the whole game. Keep going 💪', 90],
    ],
  },
];

/** Bidirectional friend graph — everyone has 3-5 connections. */
const FRIENDSHIPS: Array<[string, string]> = [
  ['alexchen', 'sarahj'],
  ['alexchen', 'emilyw'],
  ['alexchen', 'jasonk'],
  ['alexchen', 'rachelg'],
  ['alexchen', 'lisapark'],
  ['sarahj', 'mikeross'],
  ['sarahj', 'jasonk'],
  ['sarahj', 'emilyw'],
  ['mikeross', 'davidm'],
  ['mikeross', 'jasonk'],
  ['emilyw', 'rachelg'],
  ['emilyw', 'lisapark'],
  ['jasonk', 'davidm'],
  ['lisapark', 'rachelg'],
  ['davidm', 'rachelg'],
];

/** Pending requests so the demo user has something to act on. */
const PENDING: Array<[string, string]> = [
  ['davidm', 'alexchen'],
  ['mikeross', 'alexchen'],
];

async function clearDatabase(): Promise<void> {
  // Order matters only where cascades are absent; deleting users cascades to nearly everything.
  await prisma.storyView.deleteMany();
  await prisma.story.deleteMany();
  await prisma.like.deleteMany();
  await prisma.bookmark.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.call.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main(): Promise<void> {
  ensureUploadDirs();
  console.log('🌱 Seeding Orbit demo data...\n');

  await clearDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, env.bcryptRounds);
  const securityAnswerHash = await bcrypt.hash('orbit', env.bcryptRounds);

  // ── Users ──────────────────────────────────────────────────────────────────
  const byUsername = new Map<string, { id: string; displayName: string }>();
  for (const [index, seed] of USERS.entries()) {
    const user = await prisma.user.create({
      data: {
        username: seed.username,
        displayName: seed.displayName,
        bio: seed.bio,
        phone: seed.phone,
        email: seed.email,
        passwordHash,
        securityQuestion: 'What is the name of this app?',
        securityAnswerHash,
        avatarUrl: generateAvatar(seed.username, seed.displayName),
        coverUrl: generateCover(seed.username),
        isOnboarded: true,
        isOnline: index % 3 === 0,
        lastSeen: ago(minutes(index * 7)),
        createdAt: ago(days(120 - index * 9)),
        privacySettings: JSON.stringify(DEFAULT_PRIVACY),
        notificationSettings: JSON.stringify(DEFAULT_NOTIFICATION_SETTINGS),
      },
    });
    byUsername.set(seed.username, { id: user.id, displayName: user.displayName });
  }
  const uid = (username: string): string => byUsername.get(username)!.id;
  console.log(`   ✓ ${USERS.length} users`);

  // ── Friendships ────────────────────────────────────────────────────────────
  for (const [a, b] of FRIENDSHIPS) {
    await prisma.friendship.create({
      data: { requesterId: uid(a), addresseeId: uid(b), status: 'accepted', createdAt: ago(days(30)) },
    });
  }
  for (const [requester, addressee] of PENDING) {
    await prisma.friendship.create({
      data: { requesterId: uid(requester), addresseeId: uid(addressee), status: 'pending', createdAt: ago(hours(5)) },
    });
  }
  console.log(`   ✓ ${FRIENDSHIPS.length} friendships + ${PENDING.length} pending requests`);

  // ── Posts, media, likes, comments ──────────────────────────────────────────
  const otherUsernames = (exclude: string) => USERS.map((u) => u.username).filter((u) => u !== exclude);
  let commentTotal = 0;
  let likeTotal = 0;

  for (const [index, seed] of POSTS.entries()) {
    const mediaUrls: string[] = [];
    const mediaTypes: string[] = [];
    if (seed.photos) {
      for (const [photoIndex, label] of seed.photos.entries()) {
        mediaUrls.push(generatePhoto(`post-${index}-${photoIndex}`, label, 'posts'));
        mediaTypes.push('image');
      }
    }

    const post = await prisma.post.create({
      data: {
        userId: uid(seed.author),
        contentText: seed.text,
        mediaUrl: mediaUrls.join(','),
        mediaType: mediaTypes.join(','),
        linkUrl: seed.link?.url ?? '',
        linkPreview: seed.link
          ? JSON.stringify({
              url: seed.link.url,
              domain: seed.link.siteName,
              title: seed.link.title,
              description: seed.link.description,
              image: '',
              siteName: seed.link.siteName,
            })
          : '',
        visibility: seed.visibility ?? 'public',
        createdAt: ago(minutes(seed.minutesAgo)),
        updatedAt: ago(minutes(seed.minutesAgo)),
      },
    });

    // 0-8 likes from other users.
    const candidates = otherUsernames(seed.author);
    const likeCount = Math.floor(random() * Math.min(8, candidates.length));
    const shuffled = [...candidates].sort(() => random() - 0.5).slice(0, likeCount);
    for (const liker of shuffled) {
      await prisma.like.create({
        data: { userId: uid(liker), postId: post.id, createdAt: ago(minutes(seed.minutesAgo - 1)) },
      });
    }
    likeTotal += shuffled.length;

    let commentCount = 0;
    for (const [commentIndex, comment] of (seed.comments ?? []).entries()) {
      const created = await prisma.comment.create({
        data: {
          postId: post.id,
          userId: uid(comment.author),
          content: comment.text,
          createdAt: ago(minutes(Math.max(1, seed.minutesAgo - (commentIndex + 1) * 3))),
        },
      });
      commentCount += 1;
      for (const [replyIndex, reply] of (comment.replies ?? []).entries()) {
        await prisma.comment.create({
          data: {
            postId: post.id,
            userId: uid(reply.author),
            parentCommentId: created.id,
            content: reply.text,
            createdAt: ago(minutes(Math.max(1, seed.minutesAgo - (commentIndex + 1) * 3 - (replyIndex + 1)))),
          },
        });
        commentCount += 1;
      }
    }
    commentTotal += commentCount;

    await prisma.post.update({
      where: { id: post.id },
      data: {
        likesCount: shuffled.length,
        commentsCount: commentCount,
        sharesCount: Math.floor(random() * 3),
      },
    });
  }
  console.log(`   ✓ ${POSTS.length} posts, ${likeTotal} likes, ${commentTotal} comments`);

  // ── Stories ────────────────────────────────────────────────────────────────
  for (const [index, story] of STORIES.entries()) {
    const created = await prisma.story.create({
      data: {
        userId: uid(story.author),
        mediaUrl: generatePhoto(`story-${index}`, story.label, 'stories', 'portrait'),
        mediaType: 'image',
        caption: story.caption,
        createdAt: ago(hours(story.hoursAgo)),
        expiresAt: new Date(Date.now() + hours(env.storyTtlHours - story.hoursAgo)),
      },
    });
    // A few viewers each, never the author.
    const viewers = USERS.map((u) => u.username)
      .filter((u) => u !== story.author)
      .sort(() => random() - 0.5)
      .slice(0, Math.floor(random() * 4) + 1);
    for (const viewer of viewers) {
      await prisma.storyView.create({
        data: { storyId: created.id, userId: uid(viewer), viewedAt: ago(hours(story.hoursAgo) - minutes(10)) },
      });
    }
  }
  console.log(`   ✓ ${STORIES.length} active stories`);

  // ── Direct message threads ─────────────────────────────────────────────────
  for (const thread of DM_THREADS) {
    const conversation = await prisma.conversation.create({
      data: {
        type: 'direct',
        createdBy: uid(thread.a),
        createdAt: ago(days(3)),
        members: {
          create: [
            { userId: uid(thread.a), role: 'member', lastReadAt: ago(minutes(30)) },
            { userId: uid(thread.b), role: 'member', lastReadAt: ago(minutes(120)) },
          ],
        },
      },
    });
    for (const [sender, content, minutesAgo] of thread.messages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: uid(sender),
          content,
          isRead: minutesAgo > 60,
          createdAt: ago(minutes(minutesAgo)),
        },
      });
    }
  }
  console.log(`   ✓ ${DM_THREADS.length} direct message threads`);

  // ── Groups, group feeds, group chats ───────────────────────────────────────
  for (const [groupIndex, group] of GROUPS.entries()) {
    const slug = group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const created = await prisma.group.create({
      data: {
        name: group.name,
        description: group.description,
        avatarUrl: generateAvatar(`group-${slug}`, group.name),
        coverUrl: generateCover(`group-${slug}`, 'groups'),
        createdBy: uid(group.owner),
        privacy: group.privacy,
        maxMembers: env.maxGroupMembers,
        inviteCode: inviteCode(),
        createdAt: ago(days(45 - groupIndex * 5)),
        members: {
          create: group.members.map((member) => ({
            userId: uid(member),
            role: member === group.owner ? 'admin' : 'member',
            joinedAt: ago(days(40 - groupIndex * 4)),
          })),
        },
      },
    });

    for (const [postIndex, post] of group.posts.entries()) {
      await prisma.post.create({
        data: {
          userId: uid(post.author),
          groupId: created.id,
          contentText: post.text,
          mediaUrl: post.photo ? generatePhoto(`group-${groupIndex}-${postIndex}`, post.photo, 'posts') : '',
          mediaType: post.photo ? 'image' : '',
          visibility: 'friends',
          createdAt: ago(minutes(post.minutesAgo)),
          updatedAt: ago(minutes(post.minutesAgo)),
          likesCount: Math.floor(random() * 5),
        },
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        type: 'group',
        name: group.name,
        avatarUrl: created.avatarUrl,
        createdBy: uid(group.owner),
        groupId: created.id,
        maxMembers: env.maxGroupMembers,
        createdAt: ago(days(40)),
        members: {
          create: group.members.map((member) => ({
            userId: uid(member),
            role: member === group.owner ? 'admin' : 'member',
            lastReadAt: ago(minutes(60)),
          })),
        },
      },
    });

    for (const [sender, content, minutesAgo] of group.chat) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: uid(sender),
          content,
          isRead: minutesAgo > 90,
          createdAt: ago(minutes(minutesAgo)),
        },
      });
    }
  }
  console.log(`   ✓ ${GROUPS.length} groups with feeds and group chats`);

  // ── Call history ───────────────────────────────────────────────────────────
  const CALLS: Array<[string, string, 'voice' | 'video', string, number, number]> = [
    ['sarahj', 'alexchen', 'video', 'ended', 180, 742],
    ['alexchen', 'jasonk', 'voice', 'ended', 420, 320],
    ['emilyw', 'alexchen', 'video', 'missed', 0, 200],
    ['alexchen', 'rachelg', 'voice', 'ended', 95, 90],
    ['davidm', 'alexchen', 'voice', 'rejected', 0, 45],
  ];
  for (const [caller, receiver, type, status, duration, minutesAgo] of CALLS) {
    const startedAt = ago(minutes(minutesAgo));
    await prisma.call.create({
      data: {
        callerId: uid(caller),
        receiverId: uid(receiver),
        type,
        status,
        startedAt,
        endedAt: new Date(startedAt.getTime() + duration * 1000),
      },
    });
  }
  console.log(`   ✓ ${CALLS.length} calls in history`);

  // ── Notifications for the primary demo user ────────────────────────────────
  const demo = uid('alexchen');
  const NOTIFICATIONS: Array<{
    actor: string;
    type: string;
    content: string;
    minutesAgo: number;
    referenceType?: string;
  }> = [
    { actor: 'emilyw', type: 'post_like', content: 'Emily Williams liked your post', minutesAgo: 8 },
    { actor: 'sarahj', type: 'post_comment', content: 'Sarah Johnson commented on your post', minutesAgo: 14 },
    { actor: 'davidm', type: 'friend_request', content: 'David Martinez sent you a friend request', minutesAgo: 22, referenceType: 'friendship' },
    { actor: 'lisapark', type: 'post_like', content: 'Lisa Park liked your post', minutesAgo: 33 },
    { actor: 'rachelg', type: 'message', content: 'Rachel Green: Ok two are yours. Come get them', minutesAgo: 60, referenceType: 'conversation' },
    { actor: 'mikeross', type: 'friend_request', content: 'Mike Ross sent you a friend request', minutesAgo: 75, referenceType: 'friendship' },
    { actor: 'emilyw', type: 'story_reply', content: 'Emily Williams replied to your story', minutesAgo: 96 },
    { actor: 'jasonk', type: 'post_comment', content: 'Jason Kumar commented on your post', minutesAgo: 120 },
    { actor: 'sarahj', type: 'group_post', content: 'Sarah Johnson posted in Photography Club', minutesAgo: 150, referenceType: 'group' },
    { actor: 'davidm', type: 'missed_call', content: 'You missed a voice call from David Martinez', minutesAgo: 180, referenceType: 'call' },
    { actor: 'rachelg', type: 'post_like', content: 'Rachel Green liked your post', minutesAgo: 210 },
    { actor: 'lisapark', type: 'group_join', content: 'Lisa Park joined Photography Club', minutesAgo: 260, referenceType: 'group' },
    { actor: 'jasonk', type: 'mention', content: 'Jason Kumar mentioned you in a post', minutesAgo: 320 },
  ];

  const firstPost = await prisma.post.findFirst({
    where: { userId: demo },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  for (const notification of NOTIFICATIONS) {
    await prisma.notification.create({
      data: {
        userId: demo,
        actorId: uid(notification.actor),
        type: notification.type,
        content: notification.content,
        referenceId: firstPost?.id ?? '',
        referenceType: notification.referenceType ?? 'post',
        isRead: false,
        createdAt: ago(minutes(notification.minutesAgo)),
      },
    });
  }
  console.log(`   ✓ ${NOTIFICATIONS.length} unread notifications for @alexchen`);

  console.log(`
✅ Orbit is seeded and ready.

   Sign in with any of these accounts — password for all: ${DEMO_PASSWORD}

     @alexchen   Alex Chen        (best starting point — has notifications, DMs and calls)
     @sarahj     Sarah Johnson
     @mikeross   Mike Ross
     @emilyw     Emily Williams
     @jasonk     Jason Kumar
     @lisapark   Lisa Park
     @davidm     David Martinez
     @rachelg    Rachel Green
`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
