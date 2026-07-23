/**
 * Zero-dependency i18n for tenant sites. UI chrome is translated; content the
 * temple enters (names, descriptions, schedules) renders as written. The
 * dictionary is plain data, importable from server and client components —
 * client components receive `locale` as a prop and call getDict themselves.
 */

export type Locale = 'en' | 'bn';
export const LOCALES: readonly Locale[] = ['en', 'bn'];
export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', bn: 'বাং' };

export interface Dict {
  nav: {
    home: string;
    about: string;
    gallery: string;
    contact: string;
    donate: string;
    volunteer: string;
  };
  footer: { poweredBy: string };
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
  };
}

const en: Dict = {
  nav: {
    home: 'Home',
    about: 'About',
    gallery: 'Gallery',
    contact: 'Contact',
    donate: 'Donate',
    volunteer: 'Volunteer',
  },
  footer: { poweredBy: 'Powered by' },
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
  },
};

const bn: Dict = {
  nav: {
    home: 'হোম',
    about: 'আমাদের সম্পর্কে',
    gallery: 'গ্যালারি',
    contact: 'যোগাযোগ',
    donate: 'দান করুন',
    volunteer: 'স্বেচ্ছাসেবা',
  },
  footer: { poweredBy: 'পরিচালনায়' },
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
  },
};

const DICTIONARIES: Record<Locale, Dict> = { en, bn };

export function getDict(locale: Locale): Dict {
  return DICTIONARIES[locale] ?? en;
}
