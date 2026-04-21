export const environment = {
  production: false,
  supabase: {
    url: 'https://bxsrcjyguitmkrkqtxdn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4c3JjanlndWl0bWtya3F0eGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM4NDksImV4cCI6MjA5MTA3OTg0OX0.6aV7tNbXERY8aZvicGjZJgnyI4Aj-sh4od1bqvwn0Ik',
  },
  paddle: {
    clientToken: 'test_REPLACE_WITH_SANDBOX_TOKEN', // get from Paddle → Sandbox → Developer Tools → Authentication
    sandbox: true,
    prices: {
      clicks10:        'pri_01knkm1txrj4apeh0tcx4m0p7f', // 10 Extra Clicks — $0.99
      clicks100:       'pri_01knkm331exk8fjyc7hgwbndrd',  // 100 Extra Clicks — $4.99
      unlimited24h:    'pri_01knkm48htnz5qjxr3w1ds0j6w',  // Unlimited 24h — $1.99
      unlimitedMonth:  'pri_01knkm506r192ejfp1gajq67aw',  // Monthly Unlimited — $4.99/mo
      nameOnEgg:       'pri_01knkm5je3xarr8crc5fbtamka',  // Name on the Egg — $2.99
      goldenCursor:    'pri_01kpqk5ccxs3yreysrv53m0pf5', // Golden Cursor — $1.99
      crackBadge:      'pri_01kpqk6zz6kgh2vepepk59aqwz', // Crack Badge (limited) — $1.99
      diamondSkin:     'pri_01kpqk8t53a836f29bnp3rpwce', // Diamond Egg Skin — $3.99
    },
  },
};
