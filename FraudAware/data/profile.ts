export type ProfileStat = {
  id: string;
  label: string;
  value: number;
};

export type ProfileMenuItem = {
  id: string;
  label: string;
};

export type ProfileCompany = {
  name: string;
  logo: string;
};

export type Profile = {
  fullName: string;
  headline: string;
  location: string;
  avatar: string;
  isVerified: boolean;
  company: ProfileCompany;
  stats: ProfileStat[];
  menu: ProfileMenuItem[];
  isPremium: boolean;
  premiumLabel: string;
};

export const PROFILE: Profile = {
  fullName: 'Kajanthan U',
  headline: 'Frontend Developer Intern | Next.js & TypeScript Enthusiast | Cloud of Goods (iLabs)',
  location: 'Malabe, Western Province, Sri Lanka',
  avatar: 'https://i.pravatar.cc/300?img=12',
  isVerified: true,
  company: {
    name: 'SLIIT',
    logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/SLIIT_logo.svg/1200px-SLIIT_logo.svg.png',
  },
  stats: [
    { id: 'viewers', label: 'profile viewers', value: 61 },
    { id: 'impressions', label: 'post impressions', value: 132 },
  ],
  menu: [
    { id: 'puzzle', label: 'Puzzle games' },
    { id: 'saved', label: 'Saved posts' },
    { id: 'groups', label: 'Groups' },
  ],
  isPremium: false,
  premiumLabel: 'Try Premium for Rs 0',
};
