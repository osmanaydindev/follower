import type { Dict } from './types';

export const en: Dict = {
  code: 'en',
  htmlLang: 'en',
  localeTag: 'en-GB',
  name: 'English',

  meta: {
    title: 'Follower — Instagram follower analysis',
    description:
      'See who does not follow you back, who your fans are and every mutual connection, on one calm screen. We never ask for your Instagram password and we never sell your data.',
    panelTitle: 'Dashboard — Follower',
  },

  common: {
    loading: 'Loading…',
    retry: 'Please try again',
    cancel: 'Cancel',
    close: 'Close',
    back: 'Back',
    errorTitle: 'That could not be completed',
    skipToContent: 'Skip to content',
    openMenu: 'Open menu',
    theme: 'Theme',
    themeLight: 'Light theme',
    themeDark: 'Dark theme',
    language: 'Language',
  },

  nav: {
    brand: 'Follower',
    what: 'What it does',
    trust: 'Assurances',
    install: 'Add to home screen',
    faq: 'Questions',
    analyze: 'Start your analysis',
    panel: 'My dashboard',
  },

  hero: {
    badge: 'Instagram follower analysis',
    titleLead: 'Who actually',
    titleAccent: 'follows you back?',
    subtitle:
      'The accounts you follow that never followed you back, the people following you that you have not followed, and every mutual connection — all on one calm screen.',
    cta: 'Start your analysis',
    ctaSecondary: 'How it works',
    note: 'Nothing to install. It runs in your browser, and you can add it to your home screen if you like.',
    mockupLabel: 'Preview of the app, shown with sample data',
  },

  demo: {
    name: 'Deniz Yılmaz',
    handle: 'denizyilmaz',
    posts: 'Posts',
    followers: 'Followers',
    following: 'Following',
    tabMutual: 'Mutual',
    tabNotBack: 'Not following back',
    tabFans: 'Fans',
    hint: 'The tabs are tappable',
  },

  features: {
    eyebrow: 'What it does',
    title: 'Four questions, answered plainly',
    subtitle: 'No interpretation, no guesswork. Just lists and numbers.',
    items: [
      {
        key: 'notBack',
        title: 'Not following back',
        body: 'Accounts you follow that do not follow you.',
      },
      {
        key: 'fans',
        title: 'Your fans',
        body: 'Accounts following you that you have never followed back.',
      },
      {
        key: 'mutuals',
        title: 'Mutual follows',
        body: 'The full list and current count of the accounts you and they both follow.',
      },
      {
        key: 'history',
        title: 'Change tracking',
        body: 'From the second analysis onward, it shows who unfollowed you and who is new.',
      },
    ],
  },

  trust: {
    eyebrow: 'Assurances',
    title: 'Why you can use this with confidence',
    subtitle:
      'We state plainly what we do with your data — and what we do not. We would rather you read this section than skip it.',
    items: [
      {
        key: 'browser',
        tone: 'success',
        title: 'We never ask for your Instagram password',
        body: 'Lists are read in the Instagram session already open in your browser. Your password, Instagram session cookie and any account sign-in key never reach our server.',
      },
      {
        key: 'protect',
        tone: 'info',
        title: 'We work carefully to protect your account',
        body: 'Your lists are fetched page by page with pauses in between, and when Instagram asks us to slow down we wait rather than insist. That is precisely why an analysis takes a minute or two. Not rushing is the best way to look after your account.',
      },
      {
        key: 'control',
        tone: 'success',
        title: 'Nothing happens on your behalf',
        body: 'We never post, send messages or follow anyone for you. This first version only reads and compares your lists.',
      },
      {
        key: 'data',
        tone: 'success',
        title: 'Your data is not sold',
        body: 'No ad networks, no tracking scripts, no analytics. The only thing we store is a copy of your latest follower list, so we can answer "who unfollowed me". Signing out deletes your session.',
        linkLabel: 'How do I delete my data?',
      },
    ],
  },

  install: {
    eyebrow: 'Add to home screen',
    title: 'Like an app, without the store',
    subtitle:
      'You can add Follower to your phone’s home screen. Once added it opens full screen, without an address bar, and sits alongside your other apps.',
    osLabel: 'Operating system',
    ios: 'iPhone / iPad',
    android: 'Android',
    detected: 'Chosen from your device — you can change it.',
    stepLabel: 'Step',
    stepOf: '{n} of {total}',
    prev: 'Previous step',
    next: 'Next step',
    installNow: 'Add to home screen',
    installNowHint: 'Your browser supports adding it directly, so you can skip the steps.',
    httpsNote:
      'On Android the direct button only appears over a secure (https) connection. If it is missing you can follow the steps by hand; on iPhone, adding it manually always works.',
    iosSteps: [
      {
        title: 'Open the page in Safari',
        body: 'The add-to-home-screen option lives in Safari. If you are in another browser, simply open this address there.',
        caption: 'Safari · address bar',
      },
      {
        title: 'Tap the Share button',
        body: 'The square with an arrow pointing out of it, in the toolbar at the bottom. Tapping it opens the share menu.',
        caption: 'Share',
      },
      {
        title: 'Choose “Add to Home Screen”',
        body: 'Scroll the menu up a little. It is the row with a plus sign inside a square.',
        caption: 'Add to Home Screen',
      },
      {
        title: 'Tap “Add”',
        body: 'You can shorten the name first if you like. The icon appears on your home screen as soon as you confirm.',
        caption: 'Added',
      },
    ],
    androidSteps: [
      {
        title: 'Open the page in Chrome',
        body: 'The option lives in Chrome. Samsung Internet offers something similar.',
        caption: 'Chrome · address bar',
      },
      {
        title: 'Open the menu, top right',
        body: 'Tap the three dots to the right of the address bar.',
        caption: 'Menu',
      },
      {
        title: 'Choose “Install app”',
        body: 'Some versions say “Add to Home screen”; both do the same thing.',
        caption: 'Install app',
      },
      {
        title: 'Confirm “Install”',
        body: 'The icon is added to your home screen and your app drawer.',
        caption: 'Installed',
      },
    ],
    phoneAlt: 'Animation of the add-to-home-screen steps',
  },

  faq: {
    eyebrow: 'Questions',
    title: 'Frequently asked',
    items: [
      {
        q: 'Does my Instagram password pass through your service?',
        a: 'No. You sign in to Instagram yourself in your browser. The bookmark reads the lists in that existing session; neither your password nor your Instagram session cookie is sent to us.',
      },
      {
        q: 'Is there any risk to my account?',
        a: 'Every Instagram request comes from your own browser and connection; our server never signs in to your account. Instagram can still limit usage. To reduce the chance, pages are read slowly, with pauses and in sequence, and collection stops when a limit appears.',
      },
      {
        q: 'Why does the analysis take a minute or two?',
        a: 'The lists arrive page by page and we deliberately pause in between. Fetching quickly would be the easiest way to put your account at needless risk. The slowness is a considered choice, not a shortcoming.',
      },
      {
        q: 'I use two-factor authentication. Will it work?',
        a: 'Yes. Two-factor authentication is part of your normal Instagram login. Complete it at instagram.com, then use the bookmark.',
      },
      {
        q: 'Does anything happen on my behalf?',
        a: 'No. We never post, send messages or follow anyone. This version carries out no account actions; it only reads and compares lists.',
      },
      {
        q: 'How do I have my data deleted?',
        a: 'Signing out from the dashboard deletes your session from the server. If you also want the copy of your follower list removed, follow the step on the data deletion page.',
      },
    ],
  },

  footer: {
    tagline: 'Instagram follower analysis. Calm, candid, ad-free.',
    product: 'Product',
    legal: 'Legal',
    privacy: 'Privacy',
    terms: 'Terms of use',
    deletion: 'Delete my data',
    disclaimer:
      'Follower is not affiliated with or endorsed by Instagram or Meta. It analyses the data of your own account only.',
    rights: 'All rights reserved.',
  },

  panel: {
    logout: 'Sign out',
    loggingOut: 'Signing out…',
    posts: 'Posts',
    followers: 'Followers',
    following: 'Following',
    ctaTitle: 'Relationship analysis',
    ctaBody:
      'Start the analysis to see who does not follow you back, who your fans are and every mutual follow.',
    analyze: 'Start the analysis',
    analyzing: 'Analysing…',
    reanalyze: 'Analyse again',
    lastUpdated: 'Last updated',
    cooldown: 'Try again in {m} min',
    cooldownReason:
      'Instagram has temporarily limited our requests. Insisting makes it last longer, so we are pausing briefly.',
    summaryTitle: 'Summary',
    cardMutuals: 'Mutual follows',
    cardMutualsHint: 'You follow each other',
    cardNotBack: 'Not following back',
    cardNotBackHint: 'You follow them, they do not follow you',
    cardFans: 'Your fans',
    cardFansHint: 'They follow you, you do not follow them',
    historyTitle: 'Change since last time',
    cardUnfollowed: 'Unfollowed you',
    cardUnfollowedHint: 'Present in the previous analysis, gone now',
    cardNewFollowers: 'New followers',
    cardNewFollowersHint: 'Started following after the previous analysis',
    firstRunTitle: 'Your first analysis has been saved',
    firstRunBody:
      'From the next analysis onward we can also answer "who unfollowed me" and "who is new". We kept this list so the comparison is possible.',
    phaseFollowers: 'Followers',
    phaseFollowing: 'Following',
    phaseSaving: 'Computing results',
    phaseFetching: 'Fetching {phase}',
    progressPatience:
      'The lists are fetched page by page with pauses in between. The slowness is deliberate, so your account is not flagged needlessly. Please keep this page open.',
    tabs: {
      mutuals: 'Mutual',
      notFollowingBack: 'Not following back',
      fans: 'Your fans',
      followers: 'Followers',
      following: 'Following',
      unfollowed: 'Unfollowed you',
      newFollowers: 'New followers',
    },
    tabsLabel: 'List selection',
    search: 'Search · {n} people',
    empty: 'Nobody here',
    emptyFiltered: 'No matches found',
    loadMore: 'Show more',
    showing: 'Showing {shown} of {total}',
    rowStats: '{posts} posts · {followers} followers · {following} following',
    rowStatsLoading: 'loading…',
    privateAccount: 'Private account',
    verifiedAccount: 'Verified account',
    actionUnfollow: 'Unfollow',
    actionRemove: 'Remove follower',
    actionUnfollowDone: 'Unfollowed',
    actionRemoveDone: 'Removed',
    noteBlocked: 'Not available right now',
    noteNotFollowing: 'You do not follow them',
    confirmUnfollowTitle: 'Unfollow this account?',
    confirmUnfollowBody: 'You will stop following @{username}.',
    confirmRemoveTitle: 'Remove this follower?',
    confirmRemoveBody: '@{username} will no longer follow you. Remove them from your followers?',
    blockedNotice:
      'Instagram has temporarily limited these actions. The buttons stay off for {m} minutes; not trying during that window is the best course.',
    errorNetwork: 'The server cannot be reached right now. Check your connection and try again.',
    errorSession: 'Your Instagram session is no longer valid. Sign in again at instagram.com, then start collection again.',
    errorThrottled: 'Instagram has limited our requests. Please try again in 15 minutes.',
    errorEmpty:
      'Instagram returned an empty list. That is a transfer error, so we are not saving it — otherwise the next analysis would look as though everyone had unfollowed you.',
    errorGeneric: 'The analysis could not be completed.',
    sessionExpired: 'Your session has expired. Start collection again.',
  },

  collect: {
    title: 'Collect from your browser',
    lead: 'Your lists are read in your own Instagram session, over your own connection. Our server never contacts Instagram.',
    whyTitle: 'Why it works this way',
    why: 'Instagram no longer accepts password sign-ins made from a server. Using the session already open in your browser both works and is the gentlest option for your account: the requests come from your computer, over your connection.',
    step1Title: '1. Drag the button to your bookmarks',
    step1Body: 'Drag the button below onto your browser’s bookmarks bar. If the bar is hidden, Cmd+Shift+B (Ctrl+Shift+B on Windows) shows it.',
    bookmarkletLabel: 'Follower Analysis',
    bookmarkletClickTitle: 'This button does not start collection here',
    bookmarkletClickBody: 'First drag the button to your bookmarks bar. Then, on the Instagram tab, click the bookmark you saved. On a phone, copy the code below and paste it as the address of a new bookmark.',
    copyBookmarklet: 'Copy bookmark code',
    copyDone: 'Copied',
    copyFailed: 'The code could not be copied. On desktop, drag the button to the bookmarks bar.',
    step2Title: '2. Open your own Instagram profile',
    step2Body: 'Open instagram.com in a new tab, make sure you are signed in, and open your own profile page.',
    step3Title: '3. Click the bookmark',
    step3Body: 'With Instagram open, click the bookmark. Collection starts and this page updates by itself.',
    openInstagram: 'Open Instagram in a new tab',
    waitingTitle: 'Waiting for the bookmark',
    waitingBody: 'Leave this tab open. Progress appears here once you click the bookmark on the Instagram tab.',
    collectingFollowers: 'Fetching followers',
    collectingFollowing: 'Fetching following',
    savingTitle: 'Computing results',
    patience: 'The lists are fetched page by page with pauses in between. The slowness is deliberate, so your account is not flagged needlessly. Please keep the Instagram tab open.',
    doneTitle: 'Collection complete',
    goPanel: 'See your results',
    errorAuth: 'No Instagram session or username was found. Sign in at instagram.com, open your own profile page, and click the bookmark again.',
    errorThrottled: 'Instagram rate-limited the requests. Wait a while before trying again; insisting makes it last longer.',
    limitsTitle: 'What this path does not do',
    limitsBody: 'The lists and counts are complete. Per-row post and follower counts, and unfollowing from the list, are off in this version — they would need the server to call Instagram, which is the path that does not work.',
  },

  viewers: {
    title: 'Who viewed my profile?',
    lead: 'No app can show you this, and neither do we.',
    body: [
      'Instagram does not expose profile viewers in any of its interfaces. Not in the official API, not in the "Download your information" archive, and not in the endpoints the app itself uses.',
      'So an app claiming to show it is either guessing or inventing. Either way it comes to the same thing: the names on that screen have nothing to do with who looked at your profile.',
      'We would rather show you nothing than show you something that is not true.',
    ],
    listTitle: 'Where this data is absent',
    list: [
      'Not in the official Graph API',
      'Not in the "Download your information" archive',
      'Not in the endpoints the app itself uses',
    ],
    back: 'Return to the home page',
  },

  privacy: {
    title: 'Privacy policy',
    updated: 'Last updated: 15 November 2026',
    sections: [
      {
        heading: 'In short',
        body: [
          'No ads, no tracking scripts, no analytics. We do not sell or share your data with anyone. Everything we hold is deleted when you ask.',
        ],
      },
      {
        heading: 'What we collect',
        body: [
          'Your Instagram username.',
          'Your Instagram username and a technical website-session cookie so you can open your results. We never receive your Instagram password or Instagram session cookie.',
          'A copy of your follower list from your most recent analysis (username, display name, profile picture address and account id). We keep it because "who unfollowed me" can only be answered by comparing against the previous list.',
        ],
      },
      {
        heading: 'What we do not collect',
        body: [
          'We do not read your messages, posts, likes or location.',
          'We do no advertising cookie tracking. The only cookies we set are the technical one that keeps you signed in and your language and theme preference.',
          'We load no third-party analytics.',
        ],
      },
      {
        heading: 'Where the data lives',
        body: [
          'The data sits in files on a server we rent. No cloud storage and no third-party database service is involved.',
          'Follower-list copies are written with permissions only the server user can read.',
        ],
      },
      {
        heading: 'How long it is kept',
        body: [
          'Website session: deleted the moment you sign out. If you do nothing, it expires by itself after 60 days.',
          'Follower-list copy: overwritten at your next analysis, and deleted entirely on request.',
        ],
      },
      {
        heading: 'Our relationship with Instagram',
        body: [
          'Follower is an independent tool with no affiliation to Instagram or Meta, and it is not endorsed by them. Your data is read from Instagram using your own session; Instagram’s own privacy policy applies separately.',
        ],
      },
      {
        heading: 'Contact',
        body: ['For questions and deletion requests: omnaydin1453@gmail.com'],
      },
    ],
  },

  terms: {
    title: 'Terms of use',
    updated: 'Last updated: 15 November 2026',
    sections: [
      {
        heading: 'What the service does',
        body: [
          'Follower compares your own Instagram account’s follower and following lists and shows you who does not follow you back, who your fans are and who you mutually follow. It may not be used to analyse somebody else’s account.',
        ],
      },
      {
        heading: 'Technical context and responsibility',
        body: [
          'Follower lists are read from Instagram endpoints that are not officially documented. This may conflict with Instagram’s terms and can lead to a temporary restriction on your account or a request for additional verification.',
          'To reduce that possibility we send requests slowly, with pauses and in sequence, and we wait whenever Instagram imposes a limit. Even so, we cannot claim to have removed the risk entirely. By choosing to use the service you acknowledge this.',
        ],
      },
      {
        heading: 'What you must not do',
        body: [
          'Try to analyse an account that is not yours and not signed in in your browser.',
          'Strain the service with automated tools, or use it for bulk follow and unfollow campaigns.',
          'Use the lists you obtain for harassment or unsolicited messaging.',
        ],
      },
      {
        heading: 'Warranty and limits',
        body: [
          'The service is provided "as is". When Instagram changes its interface, the analysis may stop working for a time.',
          'We cannot be held liable for restrictions on your account, data loss, or indirect damages arising from an outage.',
        ],
      },
      {
        heading: 'Changes',
        body: [
          'When these terms change, the date on this page is updated. Continuing to use the service means you accept the current terms.',
        ],
      },
    ],
  },

  deletion: {
    title: 'Delete my data',
    lead: 'We hold two things, and you can have both removed.',
    sections: [
      {
        heading: '1. The session key — you can delete this yourself',
        body: [
          'Signing out from the dashboard is enough. That deletes the session record on the server, so no further Instagram request can be made with that key. The cookie in your browser is cleared at the same time.',
        ],
      },
      {
        heading: '2. The follower-list copy — on request',
        body: [
          'We keep a copy of your latest follower list so the next analysis can tell you who unfollowed you. If you would like it removed, email us with your Instagram username; we will delete the record and write back to you.',
          'Your next analysis will then start its history from scratch. That is expected behaviour, not a fault.',
        ],
      },
      {
        heading: 'If you would also like to end it on Instagram’s side',
        body: [
          'In Instagram’s settings, under "Security → Where you are logged in", you can end our session as well. That makes the key we hold unusable immediately.',
        ],
      },
    ],
    contact: 'Email: omnaydin1453@gmail.com',
  },

  notFound: {
    title: 'This page could not be found',
    body: 'The address may be mistyped, or the page may have been removed.',
    home: 'Return to the home page',
  },

  offline: {
    title: 'No connection',
    body: 'You are offline. Please reload this page once you are back.',
  },
};

export default en;
