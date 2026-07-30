/**
 * Zero-dependency i18n for tenant sites. UI chrome is translated; content the
 * temple enters (names, descriptions, schedules) renders as written. The
 * dictionary is plain data, importable from server and client components —
 * client components receive `locale` as a prop and call getDict themselves.
 */

export type Locale = 'en' | 'bn' | 'hi';
export const LOCALES: readonly Locale[] = ['en', 'bn', 'hi'];
export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', bn: 'বাং', hi: 'हिं' };

export interface Dict {
  nav: {
    home: string;
    about: string;
    gallery: string;
    blog: string;
    events: string;
    contact: string;
    donate: string;
    volunteer: string;
    facilities: string;
    darshan: string;
    portal: string;
  };
  footer: { poweredBy: string };
  darshan: {
    eyebrow: string;
    title: string;
    intro: string;
    none: string;
    remaining: (n: number) => string;
    full: string;
    book: string;
    booking: string;
    thanks: (token: number, name: string) => string;
    yourName: string;
    phone: string;
    email: string;
    partySize: string;
    note: string;
  };
  facilities: {
    eyebrow: string;
    title: string;
    intro: string;
    none: string;
    capacity: (n: number) => string;
    request: string;
    requesting: string;
    thanks: (facility: string) => string;
    yourName: string;
    phone: string;
    email: string;
    date: string;
    purpose: string;
    note: string;
  };
  volunteer: {
    eyebrow: string;
    title: string;
    intro: string;
    none: string;
    slotsFull: string;
    signUp: string;
    signingUp: string;
    thanks: (name: string) => string;
    yourName: string;
    phone: string;
    email: string;
    note: string;
  };
  hero: {
    welcomeTo: string;
    tagline: string;
    makeDonation: string;
    bookPuja: string;
  };
  home: {
    campaignsEyebrow: string;
    campaignsTitle: string;
    raisedOf: (raised: string, goal: string) => string;
    noticesEyebrow: string;
    notices: string;
    sitePreparing: string;
    dailySchedule: string;
    calendarEyebrow: string;
    upcomingEvents: string;
    festival: string;
    viewAllEvents: string;
    servicesEyebrow: string;
    bookPuja: string;
    communityEyebrow: string;
    becomeMember: string;
    supportEyebrow: string;
    makeDonation: string;
    donationsComingSoon: (name: string) => string;
  };
  about: {
    eyebrow: string;
    comingSoon: string;
    getInTouch: string;
    ourTemple: string;
    ourHistory: string;
  };
  gallery: {
    eyebrow: string;
    comingSoon: string;
    seeSchedule: string;
  };
  blog: {
    eyebrow: string;
    title: string;
    comingSoon: string;
    readMore: string;
    by: (name: string) => string;
    back: string;
  };
  events: {
    eyebrow: string;
    title: string;
    none: string;
    upcoming: string;
    past: string;
    festival: string;
    prev: string;
    next: string;
    pageOf: (page: number, pages: number) => string;
  };
  contact: {
    eyebrow: string;
    address: string;
    phone: string;
    email: string;
    followUs: string;
    sendMessage: string;
    formIntro: string;
    replyHint: string;
    message: string;
    send: string;
    sending: string;
  };
  forms: {
    amount: (currency: string) => string;
    yourName: string;
    emailForReceipt: string;
    phone: string;
    processing: string;
    poweredBy: (provider: string) => string;
    donateFor: (amount: string) => string;
    choosePuja: string;
    preferredDate: string;
    bookFor: (amount: string) => string;
    bookPuja: string;
    choosePlan: string;
    joinFor: (amount: string) => string;
    join: string;
  };
  donationComplete: {
    thankYouTitle: string;
    thankYouBody: (name: string, receipt: string) => string;
    cancelledTitle: string;
    cancelledBody: string;
    failedTitle: string;
    failedBody: string;
    tryAgain: string;
    donateAgain: string;
    viewInPortal: string;
  };
  portal: {
    eyebrow: string;
    loginTitle: string;
    loginIntro: string;
    emailLabel: string;
    sendLink: string;
    sending: string;
    welcomeBack: (name: string) => string;
    lifetimeGiving: string;
    thisYear: string;
    recentDonations: string;
    viewAllDonations: string;
    donationHistoryTitle: string;
    viewReceipt: string;
    noDonations: string;
    logout: string;
    backToDashboard: string;
  };
}

const en: Dict = {
  nav: {
    home: 'Home',
    about: 'About',
    gallery: 'Gallery',
    blog: 'Blog',
    events: 'Events',
    contact: 'Contact',
    donate: 'Donate',
    volunteer: 'Volunteer',
    facilities: 'Halls',
    darshan: 'Darshan',
    portal: 'My Donations',
  },
  footer: { poweredBy: 'Powered by' },
  darshan: {
    eyebrow: 'Plan your visit',
    title: 'Darshan Booking',
    intro: 'Reserve a free timed-entry token for darshan. Show it at the gate.',
    none: 'No darshan slots are open for booking right now. Please check back soon.',
    remaining: (n) => `${n} place${n === 1 ? '' : 's'} left`,
    full: 'Fully booked',
    book: 'Book token',
    booking: 'Booking…',
    thanks: (token, name) =>
      `Booked! Token #${token} for ${name}. Please show this at the gate.`,
    yourName: 'Your name',
    phone: 'Phone',
    email: 'Email (optional)',
    partySize: 'Number of people',
    note: 'Note (optional)',
  },
  facilities: {
    eyebrow: 'Book a space',
    title: 'Halls & Facilities',
    intro: 'Reserve a hall for weddings, ceremonies and gatherings.',
    none: 'No facilities are available for booking right now. Please check back soon.',
    capacity: (n) => `Up to ${n} guests`,
    request: 'Request this date',
    requesting: 'Sending…',
    thanks: (facility) =>
      `Thank you! Your request for ${facility} was received. The temple will confirm availability.`,
    yourName: 'Your name',
    phone: 'Phone',
    email: 'Email (optional)',
    date: 'Preferred date',
    purpose: 'Purpose (e.g. wedding)',
    note: 'Note (optional)',
  },
  volunteer: {
    eyebrow: 'Get involved',
    title: 'Volunteer With Us',
    intro: 'Lend a hand at the temple — sign up for a seva below.',
    none: 'No volunteer opportunities are open right now. Please check back soon.',
    slotsFull: 'All slots filled',
    signUp: 'Sign up',
    signingUp: 'Signing up…',
    thanks: (name) => `Thank you, ${name}! The temple will be in touch.`,
    yourName: 'Your name',
    phone: 'Phone',
    email: 'Email (optional)',
    note: 'Note (optional)',
  },
  hero: {
    welcomeTo: 'Welcome to',
    tagline:
      'Daily worship, festivals and community — join us in person or support the temple online.',
    makeDonation: 'Make a donation',
    bookPuja: 'Book a puja',
  },
  home: {
    campaignsEyebrow: 'Fundraising',
    campaignsTitle: 'Our Campaigns',
    raisedOf: (raised, goal) => `${raised} raised of ${goal}`,
    noticesEyebrow: 'Notice board',
    notices: 'Announcements',
    sitePreparing:
      "Our website is being prepared. Soon you'll find our daily schedule, events, festivals and online donations here.",
    dailySchedule: 'Daily schedule',
    calendarEyebrow: 'Calendar',
    upcomingEvents: 'Upcoming Events & Festivals',
    festival: 'Festival',
    viewAllEvents: 'View full calendar',
    servicesEyebrow: 'Services',
    bookPuja: 'Book a Puja',
    communityEyebrow: 'Community',
    becomeMember: 'Become a Member',
    supportEyebrow: 'Support us',
    makeDonation: 'Make a Donation',
    donationsComingSoon: (name) =>
      `Online donations are coming soon for ${name}. Please contact the temple office to donate in the meantime.`,
  },
  about: {
    eyebrow: 'About',
    comingSoon: 'More about our temple is coming soon.',
    getInTouch: 'Get in touch',
    ourTemple: 'Our temple',
    ourHistory: 'Our history',
  },
  gallery: {
    eyebrow: 'Gallery',
    comingSoon: 'Photos are coming soon. Meanwhile, see our',
    seeSchedule: 'daily schedule and events',
  },
  blog: {
    eyebrow: 'News & Updates',
    title: 'From the Temple',
    comingSoon: 'No posts yet. Please check back soon.',
    readMore: 'Read more',
    by: (name) => `By ${name}`,
    back: '← All posts',
  },
  events: {
    eyebrow: 'Calendar',
    title: 'Events & Festivals',
    none: 'Nothing on the calendar yet. Please check back soon.',
    upcoming: 'Upcoming',
    past: 'Past',
    festival: 'Festival',
    prev: 'Previous',
    next: 'Next',
    pageOf: (page, pages) => `Page ${page} of ${pages}`,
  },
  contact: {
    eyebrow: 'Contact',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    followUs: 'Follow us',
    sendMessage: 'Send a message',
    formIntro: "Send us a message using the form and we'll get back to you.",
    replyHint: 'Share an email or phone number so the temple can reply.',
    message: 'Message',
    send: 'Send message',
    sending: 'Sending…',
  },
  forms: {
    amount: (currency) => `Amount (${currency})`,
    yourName: 'Your name',
    emailForReceipt: 'Email (for your receipt)',
    phone: 'Phone',
    processing: 'Opening checkout…',
    poweredBy: (provider) => `Secure checkout powered by ${provider}.`,
    donateFor: (amount) => `Donate ${amount}`,
    choosePuja: 'Choose a puja',
    preferredDate: 'Preferred date (optional)',
    bookFor: (amount) => `Book for ${amount}`,
    bookPuja: 'Book puja',
    choosePlan: 'Choose a plan',
    joinFor: (amount) => `Join for ${amount}`,
    join: 'Join',
  },
  donationComplete: {
    thankYouTitle: 'Thank you for your donation',
    thankYouBody: (name, receipt) =>
      `Your gift to ${name} was received. Your receipt number is ${receipt} — a copy has been emailed to you if you provided an address.`,
    cancelledTitle: 'Payment cancelled',
    cancelledBody: 'You cancelled the payment — nothing was charged.',
    failedTitle: 'Payment not completed',
    failedBody:
      'The payment could not be completed. No money has been recorded. Please try again.',
    tryAgain: 'Try again',
    donateAgain: 'Make another donation',
    viewInPortal: 'View all your donations & receipts anytime in the donor portal',
  },
  portal: {
    eyebrow: 'Donor portal',
    loginTitle: 'View your donations',
    loginIntro:
      "Enter the email address on file with the temple and we'll send you a sign-in link — no password needed.",
    emailLabel: 'Email address',
    sendLink: 'Send sign-in link',
    sending: 'Sending…',
    welcomeBack: (name) => `Welcome back, ${name}`,
    lifetimeGiving: 'Lifetime giving',
    thisYear: 'This financial year',
    recentDonations: 'Recent donations',
    viewAllDonations: 'View all donations',
    donationHistoryTitle: 'Donation history',
    viewReceipt: 'View receipt',
    noDonations: "You don't have any recorded donations yet.",
    logout: 'Sign out',
    backToDashboard: '← My donations',
  },
};

const bn: Dict = {
  nav: {
    home: 'হোম',
    about: 'আমাদের সম্পর্কে',
    gallery: 'গ্যালারি',
    blog: 'ব্লগ',
    events: 'অনুষ্ঠান',
    contact: 'যোগাযোগ',
    donate: 'দান করুন',
    volunteer: 'স্বেচ্ছাসেবা',
    facilities: 'হল',
    darshan: 'দর্শন',
    portal: 'আমার দান',
  },
  footer: { poweredBy: 'পরিচালনায়' },
  darshan: {
    eyebrow: 'আপনার দর্শন পরিকল্পনা করুন',
    title: 'দর্শন বুকিং',
    intro: 'দর্শনের জন্য একটি বিনামূল্যের সময়-নির্ধারিত টোকেন সংরক্ষণ করুন। গেটে দেখান।',
    none: 'এই মুহূর্তে বুকিংয়ের জন্য কোনো দর্শন স্লট নেই। শীঘ্রই আবার দেখুন।',
    remaining: (n) => `${n}টি স্থান বাকি`,
    full: 'সম্পূর্ণ বুক হয়ে গেছে',
    book: 'টোকেন বুক করুন',
    booking: 'বুক হচ্ছে…',
    thanks: (token, name) => `বুক হয়েছে! ${name}-এর জন্য টোকেন #${token}। গেটে এটি দেখান।`,
    yourName: 'আপনার নাম',
    phone: 'ফোন',
    email: 'ইমেইল (ঐচ্ছিক)',
    partySize: 'জনসংখ্যা',
    note: 'নোট (ঐচ্ছিক)',
  },
  facilities: {
    eyebrow: 'স্থান বুক করুন',
    title: 'হল ও সুবিধা',
    intro: 'বিবাহ, অনুষ্ঠান ও সমাবেশের জন্য হল সংরক্ষণ করুন।',
    none: 'এই মুহূর্তে বুকিংয়ের জন্য কোনো সুবিধা নেই। শীঘ্রই আবার দেখুন।',
    capacity: (n) => `সর্বোচ্চ ${n} জন অতিথি`,
    request: 'এই তারিখের জন্য অনুরোধ করুন',
    requesting: 'পাঠানো হচ্ছে…',
    thanks: (facility) =>
      `ধন্যবাদ! ${facility}-এর জন্য আপনার অনুরোধ গৃহীত হয়েছে। মন্দির উপলব্ধতা নিশ্চিত করবে।`,
    yourName: 'আপনার নাম',
    phone: 'ফোন',
    email: 'ইমেইল (ঐচ্ছিক)',
    date: 'পছন্দের তারিখ',
    purpose: 'উদ্দেশ্য (যেমন বিবাহ)',
    note: 'মন্তব্য (ঐচ্ছিক)',
  },
  volunteer: {
    eyebrow: 'যুক্ত হন',
    title: 'স্বেচ্ছাসেবক হন',
    intro: 'মন্দিরের সেবায় হাত বাড়ান — নিচে একটি সেবার জন্য নাম লেখান।',
    none: 'এই মুহূর্তে কোনো স্বেচ্ছাসেবার সুযোগ খোলা নেই। শীঘ্রই আবার দেখুন।',
    slotsFull: 'সব স্থান পূর্ণ',
    signUp: 'নাম লেখান',
    signingUp: 'নথিভুক্ত হচ্ছে…',
    thanks: (name) => `ধন্যবাদ, ${name}! মন্দির শীঘ্রই যোগাযোগ করবে।`,
    yourName: 'আপনার নাম',
    phone: 'ফোন',
    email: 'ইমেইল (ঐচ্ছিক)',
    note: 'মন্তব্য (ঐচ্ছিক)',
  },
  hero: {
    welcomeTo: 'স্বাগতম',
    tagline:
      'প্রতিদিনের পূজা-অর্চনা, উৎসব ও ভক্তসমাজ — মন্দিরে আসুন কিংবা অনলাইনে মন্দিরের পাশে দাঁড়ান।',
    makeDonation: 'দান করুন',
    bookPuja: 'পূজা বুক করুন',
  },
  home: {
    campaignsEyebrow: 'তহবিল সংগ্রহ',
    campaignsTitle: 'আমাদের অভিযান',
    raisedOf: (raised, goal) => `${goal}-এর মধ্যে ${raised} সংগৃহীত`,
    noticesEyebrow: 'বিজ্ঞপ্তি',
    notices: 'ঘোষণা',
    sitePreparing:
      'আমাদের ওয়েবসাইট প্রস্তুত হচ্ছে। শীঘ্রই এখানে দৈনিক সূচি, অনুষ্ঠান, উৎসব ও অনলাইন দানের ব্যবস্থা পাবেন।',
    dailySchedule: 'দৈনিক সূচি',
    calendarEyebrow: 'পঞ্জিকা',
    upcomingEvents: 'আসন্ন অনুষ্ঠান ও উৎসব',
    festival: 'উৎসব',
    viewAllEvents: 'সম্পূর্ণ পঞ্জিকা দেখুন',
    servicesEyebrow: 'সেবা',
    bookPuja: 'পূজা বুক করুন',
    communityEyebrow: 'সম্প্রদায়',
    becomeMember: 'সদস্য হন',
    supportEyebrow: 'পাশে দাঁড়ান',
    makeDonation: 'দান করুন',
    donationsComingSoon: (name) =>
      `${name}-এর জন্য অনলাইন দান শীঘ্রই চালু হবে। আপাতত দান করতে মন্দির কার্যালয়ে যোগাযোগ করুন।`,
  },
  about: {
    eyebrow: 'আমাদের সম্পর্কে',
    comingSoon: 'আমাদের মন্দির সম্পর্কে আরও তথ্য শীঘ্রই আসছে।',
    getInTouch: 'যোগাযোগ করুন',
    ourTemple: 'আমাদের মন্দির',
    ourHistory: 'আমাদের ইতিহাস',
  },
  gallery: {
    eyebrow: 'গ্যালারি',
    comingSoon: 'ছবি শীঘ্রই আসছে। ইতিমধ্যে দেখুন আমাদের',
    seeSchedule: 'দৈনিক সূচি ও অনুষ্ঠান',
  },
  blog: {
    eyebrow: 'সংবাদ ও আপডেট',
    title: 'মন্দির থেকে',
    comingSoon: 'এখনো কোনো পোস্ট নেই। শীঘ্রই আবার দেখুন।',
    readMore: 'আরও পড়ুন',
    by: (name) => `লিখেছেন ${name}`,
    back: '← সব পোস্ট',
  },
  events: {
    eyebrow: 'পঞ্জিকা',
    title: 'অনুষ্ঠান ও উৎসব',
    none: 'পঞ্জিকায় এখনো কিছু নেই। শীঘ্রই আবার দেখুন।',
    upcoming: 'আসন্ন',
    past: 'অতীত',
    festival: 'উৎসব',
    prev: 'পূর্ববর্তী',
    next: 'পরবর্তী',
    pageOf: (page, pages) => `পৃষ্ঠা ${page} / ${pages}`,
  },
  contact: {
    eyebrow: 'যোগাযোগ',
    address: 'ঠিকানা',
    phone: 'ফোন',
    email: 'ইমেইল',
    followUs: 'আমাদের অনুসরণ করুন',
    sendMessage: 'বার্তা পাঠান',
    formIntro: 'ফর্মটি ব্যবহার করে আমাদের বার্তা পাঠান — আমরা শীঘ্রই উত্তর দেব।',
    replyHint: 'মন্দির যাতে উত্তর দিতে পারে সেজন্য ইমেইল বা ফোন নম্বর দিন।',
    message: 'বার্তা',
    send: 'বার্তা পাঠান',
    sending: 'পাঠানো হচ্ছে…',
  },
  forms: {
    amount: (currency) => `পরিমাণ (${currency})`,
    yourName: 'আপনার নাম',
    emailForReceipt: 'ইমেইল (রসিদের জন্য)',
    phone: 'ফোন',
    processing: 'চেকআউট খুলছে…',
    poweredBy: (provider) => `${provider}-এর নিরাপদ চেকআউট।`,
    donateFor: (amount) => `${amount} দান করুন`,
    choosePuja: 'পূজা নির্বাচন করুন',
    preferredDate: 'পছন্দের তারিখ (ঐচ্ছিক)',
    bookFor: (amount) => `${amount}-এ বুক করুন`,
    bookPuja: 'পূজা বুক করুন',
    choosePlan: 'প্ল্যান নির্বাচন করুন',
    joinFor: (amount) => `${amount}-এ সদস্য হন`,
    join: 'সদস্য হন',
  },
  donationComplete: {
    thankYouTitle: 'আপনার দানের জন্য ধন্যবাদ',
    thankYouBody: (name, receipt) =>
      `${name}-এ আপনার দান গৃহীত হয়েছে। আপনার রসিদ নম্বর ${receipt} — ইমেইল ঠিকানা দিয়ে থাকলে একটি কপি পাঠানো হয়েছে।`,
    cancelledTitle: 'পেমেন্ট বাতিল হয়েছে',
    cancelledBody: 'আপনি পেমেন্ট বাতিল করেছেন — কোনো টাকা কাটা হয়নি।',
    failedTitle: 'পেমেন্ট সম্পন্ন হয়নি',
    failedBody: 'পেমেন্টটি সম্পন্ন করা যায়নি। কোনো টাকা কাটা হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
    tryAgain: 'আবার চেষ্টা করুন',
    donateAgain: 'আরেকটি দান করুন',
    viewInPortal: 'দাতা পোর্টালে যেকোনো সময় আপনার সব দান ও রসিদ দেখুন',
  },
  portal: {
    eyebrow: 'দাতা পোর্টাল',
    loginTitle: 'আপনার দান দেখুন',
    loginIntro:
      'মন্দিরে নথিভুক্ত ইমেইল ঠিকানাটি দিন — আমরা আপনাকে সাইন-ইন লিঙ্ক পাঠাবো, কোনো পাসওয়ার্ড লাগবে না।',
    emailLabel: 'ইমেইল ঠিকানা',
    sendLink: 'সাইন-ইন লিঙ্ক পাঠান',
    sending: 'পাঠানো হচ্ছে…',
    welcomeBack: (name) => `স্বাগতম, ${name}`,
    lifetimeGiving: 'সর্বমোট দান',
    thisYear: 'এই আর্থিক বছর',
    recentDonations: 'সাম্প্রতিক দান',
    viewAllDonations: 'সব দান দেখুন',
    donationHistoryTitle: 'দানের ইতিহাস',
    viewReceipt: 'রসিদ দেখুন',
    noDonations: 'আপনার এখনো কোনো নথিভুক্ত দান নেই।',
    logout: 'সাইন আউট',
    backToDashboard: '← আমার দান',
  },
};

const hi: Dict = {
  nav: {
    home: 'होम',
    about: 'हमारे बारे में',
    gallery: 'गैलरी',
    blog: 'ब्लॉग',
    events: 'कार्यक्रम',
    contact: 'संपर्क',
    donate: 'दान करें',
    volunteer: 'स्वयंसेवा',
    facilities: 'हॉल',
    darshan: 'दर्शन',
    portal: 'मेरा दान',
  },
  footer: { poweredBy: 'द्वारा संचालित' },
  darshan: {
    eyebrow: 'अपनी यात्रा की योजना बनाएं',
    title: 'दर्शन बुकिंग',
    intro: 'दर्शन के लिए एक निःशुल्क समय-निर्धारित टोकन आरक्षित करें। गेट पर दिखाएं।',
    none: 'अभी बुकिंग के लिए कोई दर्शन स्लॉट उपलब्ध नहीं है। कृपया जल्द ही फिर देखें।',
    remaining: (n) => `${n} स्थान शेष`,
    full: 'पूर्ण रूप से बुक',
    book: 'टोकन बुक करें',
    booking: 'बुक हो रहा है…',
    thanks: (token, name) => `बुक हो गया! ${name} के लिए टोकन #${token}। कृपया इसे गेट पर दिखाएं।`,
    yourName: 'आपका नाम',
    phone: 'फ़ोन',
    email: 'ईमेल (वैकल्पिक)',
    partySize: 'व्यक्तियों की संख्या',
    note: 'टिप्पणी (वैकल्पिक)',
  },
  facilities: {
    eyebrow: 'स्थान बुक करें',
    title: 'हॉल व सुविधाएं',
    intro: 'विवाह, समारोह और सभाओं के लिए हॉल आरक्षित करें।',
    none: 'अभी बुकिंग के लिए कोई सुविधा उपलब्ध नहीं है। कृपया जल्द ही फिर देखें।',
    capacity: (n) => `${n} तक अतिथि`,
    request: 'इस तारीख़ के लिए अनुरोध करें',
    requesting: 'भेजा जा रहा है…',
    thanks: (facility) =>
      `धन्यवाद! ${facility} के लिए आपका अनुरोध प्राप्त हो गया है। मंदिर उपलब्धता की पुष्टि करेगा।`,
    yourName: 'आपका नाम',
    phone: 'फ़ोन',
    email: 'ईमेल (वैकल्पिक)',
    date: 'पसंदीदा तारीख़',
    purpose: 'उद्देश्य (जैसे विवाह)',
    note: 'टिप्पणी (वैकल्पिक)',
  },
  volunteer: {
    eyebrow: 'जुड़ें',
    title: 'हमारे साथ स्वयंसेवा करें',
    intro: 'मंदिर में सहयोग करें — नीचे किसी सेवा के लिए नाम दर्ज करें।',
    none: 'अभी कोई स्वयंसेवा अवसर उपलब्ध नहीं है। कृपया जल्द ही फिर देखें।',
    slotsFull: 'सभी स्थान भर गए',
    signUp: 'नाम दर्ज करें',
    signingUp: 'दर्ज हो रहा है…',
    thanks: (name) => `धन्यवाद, ${name}! मंदिर शीघ्र ही आपसे संपर्क करेगा।`,
    yourName: 'आपका नाम',
    phone: 'फ़ोन',
    email: 'ईमेल (वैकल्पिक)',
    note: 'टिप्पणी (वैकल्पिक)',
  },
  hero: {
    welcomeTo: 'आपका स्वागत है',
    tagline: 'नित्य पूजा-अर्चना, उत्सव और सामुदायिक सेवा — मंदिर आइए या ऑनलाइन सहयोग करें।',
    makeDonation: 'दान करें',
    bookPuja: 'पूजा बुक करें',
  },
  home: {
    campaignsEyebrow: 'निधि संग्रह',
    campaignsTitle: 'हमारे अभियान',
    raisedOf: (raised, goal) => `${goal} में से ${raised} एकत्रित`,
    noticesEyebrow: 'सूचना पटल',
    notices: 'घोषणाएं',
    sitePreparing:
      'हमारी वेबसाइट तैयार की जा रही है। शीघ्र ही यहां आपको हमारी दैनिक समय-सारिणी, कार्यक्रम, उत्सव और ऑनलाइन दान की सुविधा मिलेगी।',
    dailySchedule: 'दैनिक समय-सारिणी',
    calendarEyebrow: 'पंचांग',
    upcomingEvents: 'आगामी कार्यक्रम व उत्सव',
    festival: 'उत्सव',
    viewAllEvents: 'पूरा पंचांग देखें',
    servicesEyebrow: 'सेवाएं',
    bookPuja: 'पूजा बुक करें',
    communityEyebrow: 'समुदाय',
    becomeMember: 'सदस्य बनें',
    supportEyebrow: 'सहयोग करें',
    makeDonation: 'दान करें',
    donationsComingSoon: (name) =>
      `${name} के लिए ऑनलाइन दान शीघ्र ही शुरू होगा। तब तक दान हेतु कृपया मंदिर कार्यालय से संपर्क करें।`,
  },
  about: {
    eyebrow: 'हमारे बारे में',
    comingSoon: 'हमारे मंदिर के बारे में अधिक जानकारी शीघ्र ही आएगी।',
    getInTouch: 'संपर्क करें',
    ourTemple: 'हमारा मंदिर',
    ourHistory: 'हमारा इतिहास',
  },
  gallery: {
    eyebrow: 'गैलरी',
    comingSoon: 'तस्वीरें शीघ्र ही आएंगी। तब तक देखें हमारी',
    seeSchedule: 'दैनिक समय-सारिणी और कार्यक्रम',
  },
  blog: {
    eyebrow: 'समाचार व अपडेट',
    title: 'मंदिर की ओर से',
    comingSoon: 'अभी तक कोई पोस्ट नहीं है। कृपया जल्द ही फिर देखें।',
    readMore: 'और पढ़ें',
    by: (name) => `${name} द्वारा`,
    back: '← सभी पोस्ट',
  },
  events: {
    eyebrow: 'पंचांग',
    title: 'कार्यक्रम व उत्सव',
    none: 'पंचांग में अभी कुछ भी नहीं है। कृपया जल्द ही फिर देखें।',
    upcoming: 'आगामी',
    past: 'बीते हुए',
    festival: 'उत्सव',
    prev: 'पिछला',
    next: 'अगला',
    pageOf: (page, pages) => `पृष्ठ ${page} / ${pages}`,
  },
  contact: {
    eyebrow: 'संपर्क',
    address: 'पता',
    phone: 'फ़ोन',
    email: 'ईमेल',
    followUs: 'हमें फॉलो करें',
    sendMessage: 'संदेश भेजें',
    formIntro: 'फॉर्म के माध्यम से हमें संदेश भेजें — हम शीघ्र ही उत्तर देंगे।',
    replyHint: 'मंदिर आपको उत्तर दे सके, इसके लिए ईमेल या फ़ोन नंबर साझा करें।',
    message: 'संदेश',
    send: 'संदेश भेजें',
    sending: 'भेजा जा रहा है…',
  },
  forms: {
    amount: (currency) => `राशि (${currency})`,
    yourName: 'आपका नाम',
    emailForReceipt: 'ईमेल (रसीद हेतु)',
    phone: 'फ़ोन',
    processing: 'चेकआउट खुल रहा है…',
    poweredBy: (provider) => `${provider} द्वारा सुरक्षित चेकआउट।`,
    donateFor: (amount) => `${amount} दान करें`,
    choosePuja: 'पूजा चुनें',
    preferredDate: 'पसंदीदा तारीख़ (वैकल्पिक)',
    bookFor: (amount) => `${amount} में बुक करें`,
    bookPuja: 'पूजा बुक करें',
    choosePlan: 'योजना चुनें',
    joinFor: (amount) => `${amount} में सदस्य बनें`,
    join: 'सदस्य बनें',
  },
  donationComplete: {
    thankYouTitle: 'आपके दान के लिए धन्यवाद',
    thankYouBody: (name, receipt) =>
      `${name} को आपका दान प्राप्त हो गया है। आपका रसीद नंबर ${receipt} है — यदि आपने पता दिया है तो एक प्रति ईमेल कर दी गई है।`,
    cancelledTitle: 'भुगतान रद्द किया गया',
    cancelledBody: 'आपने भुगतान रद्द कर दिया — कोई राशि नहीं काटी गई।',
    failedTitle: 'भुगतान पूरा नहीं हुआ',
    failedBody: 'भुगतान पूरा नहीं हो सका। कोई राशि दर्ज नहीं की गई है। कृपया पुनः प्रयास करें।',
    tryAgain: 'पुनः प्रयास करें',
    donateAgain: 'एक और दान करें',
    viewInPortal: 'दाता पोर्टल में कभी भी अपने सभी दान व रसीदें देखें',
  },
  portal: {
    eyebrow: 'दाता पोर्टल',
    loginTitle: 'अपने दान देखें',
    loginIntro:
      'मंदिर में दर्ज ईमेल पता डालें — हम आपको साइन-इन लिंक भेजेंगे, किसी पासवर्ड की आवश्यकता नहीं।',
    emailLabel: 'ईमेल पता',
    sendLink: 'साइन-इन लिंक भेजें',
    sending: 'भेजा जा रहा है…',
    welcomeBack: (name) => `स्वागत है, ${name}`,
    lifetimeGiving: 'कुल दान',
    thisYear: 'इस वित्तीय वर्ष',
    recentDonations: 'हाल के दान',
    viewAllDonations: 'सभी दान देखें',
    donationHistoryTitle: 'दान इतिहास',
    viewReceipt: 'रसीद देखें',
    noDonations: 'आपका अभी तक कोई दर्ज दान नहीं है।',
    logout: 'साइन आउट',
    backToDashboard: '← मेरा दान',
  },
};

const DICTIONARIES: Record<Locale, Dict> = { en, bn, hi };

export function getDict(locale: Locale): Dict {
  return DICTIONARIES[locale] ?? en;
}
