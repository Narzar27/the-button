export const environment = {
  production: true,
  supabase: {
    url: 'https://bxsrcjyguitmkrkqtxdn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4c3JjanlndWl0bWtya3F0eGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM4NDksImV4cCI6MjA5MTA3OTg0OX0.6aV7tNbXERY8aZvicGjZJgnyI4Aj-sh4od1bqvwn0Ik',
  },
  lemonSqueezy: {
    // Your Lemon Squeezy store slug (the subdomain of your store URL)
    storeSlug: 'REPLACE_WITH_STORE_SLUG',
    variants: {
      clicks10:       'REPLACE_ME', // 10 Extra Clicks — $0.99
      clicks100:      'REPLACE_ME', // 100 Extra Clicks — $4.99
      unlimited24h:   'REPLACE_ME', // Unlimited 24h — $1.99
      unlimitedMonth: 'REPLACE_ME', // Monthly Unlimited — $4.99/mo
      nameOnEgg:      'REPLACE_ME', // Name on the Egg — $2.99
      crackBadge:     'REPLACE_ME', // "I Cracked Egg #1" Badge — $1.99
      hatchNotif:     'REPLACE_ME', // Hatch Notification — $0.99
      certificate:    'REPLACE_ME', // Cracker Certificate — $1.99
      goldenCursor:   'REPLACE_ME', // Golden Cursor — $1.99
      diamondSkin:    'REPLACE_ME', // Diamond Egg Skin — $3.99
    },
  },
};
