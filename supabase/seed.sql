-- ════════════════════════════════════════════════════════════════════════
--  VeriPulse — seed.sql  (OPTIONAL demo data; runs after all migrations)
--  Lets the UI render a populated feed before live ingestion is wired.
--  Safe to skip in production. Embeddings are left null here.
-- ════════════════════════════════════════════════════════════════════════

insert into public.stories
  (id, category, location_name, lat, lng, titles, summaries, media_type,
   c2pa_verified, ai_probability_score, credibility_score, rollout_stage,
   completeness_score, source)
values
  (
    gen_random_uuid(), 'Civic', 'Salt Lake, Kolkata', 22.5867, 88.4172,
    '{"en":"Sector V waterlogging cleared after pump deployment","bn":"পাম্প মোতায়েনের পর সেক্টর ফাইভের জলাবদ্ধতা দূর","hi":"पंप तैनाती के बाद सेक्टर V का जलभराव हटा"}',
    '{"en":"Municipal teams deployed six high-capacity pumps overnight to drain Sector V after heavy rain. Traffic on the EM Bypass approach resumed by morning. Officials say desilting of primary drains is scheduled before the next spell.","bn":"ভারী বৃষ্টির পর রাতভর ছয়টি উচ্চক্ষমতার পাম্প বসিয়ে সেক্টর ফাইভের জল নামানো হয়। সকালে ইএম বাইপাসের যান চলাচল স্বাভাবিক হয়।","hi":"भारी बारिश के बाद रातभर छह उच्च क्षमता वाले पंप लगाकर सेक्टर V का पानी निकाला गया। सुबह तक ईएम बाईपास पर यातायात बहाल।"}',
    'image', true, 4.0, 86.5, 'public', 78.0, 'citizen'
  ),
  (
    gen_random_uuid(), 'Civic', 'Howrah', 22.5958, 88.2636,
    '{"en":"Bridge maintenance to shut one lane for 48 hours","bn":"সেতু রক্ষণাবেক্ষণে ৪৮ ঘণ্টা একটি লেন বন্ধ","hi":"पुल रखरखाव के लिए 48 घंटे एक लेन बंद"}',
    '{"en":"Authorities announced a 48-hour partial closure of one carriageway for structural inspection. A diversion via the service road is in effect. Commuters are advised to expect delays during peak hours.","bn":"কাঠামোগত পরিদর্শনের জন্য একটি ক্যারেজওয়ে ৪৮ ঘণ্টা আংশিক বন্ধ থাকবে বলে কর্তৃপক্ষ জানিয়েছে।","hi":"संरचनात्मक निरीक्षण के लिए एक कैरिजवे 48 घंटे आंशिक रूप से बंद रहेगा, ऐसा अधिकारियों ने घोषित किया।"}',
    'image', false, 9.0, 64.0, 'tier_2', 61.0, 'rss'
  ),
  (
    gen_random_uuid(), 'Electronics', 'Online', null, null,
    '{"en":"Claim: budget phone battery lasts 3 days — disputed","bn":"দাবি: বাজেট ফোনের ব্যাটারি ৩ দিন চলে — বিতর্কিত","hi":"दावा: बजट फोन की बैटरी 3 दिन चलती है — विवादित"}',
    '{"en":"A viral post claims a sub-₹10k phone runs three days on a charge. Verified owners report roughly a day of mixed use. The figure appears to come from a standby-only test, not real usage.","bn":"একটি ভাইরাল পোস্টের দাবি, ১০ হাজার টাকার কম দামের ফোন এক চার্জে তিন দিন চলে। যাচাইকৃত মালিকরা বলছেন বাস্তবে প্রায় একদিন।","hi":"एक वायरल पोस्ट का दावा है कि 10 हजार से कम का फोन एक चार्ज में तीन दिन चलता है। सत्यापित मालिक लगभग एक दिन बताते हैं।"}',
    'image', false, 38.0, 29.0, 'quarantined', 44.0, 'citizen'
  );

-- Products for the comparison matrix. Set primary_reviewer_id to a verified
-- owner's profile id once one exists, so the 20% reviewer share routes.
insert into public.products (id, name, category, merchant, merchant_url, price_inr, claimed_specs)
values
  ('nova-x1-8-128', 'Nova X1 (8/128)', 'Electronics', 'amazon',
   'https://www.amazon.in/s?k=Nova+X1&tag=veripulse-21', 9999, '{"battery":"3 days"}'),
  ('pulse-m5-8-128', 'Pulse M5 (8/128)', 'Electronics', 'flipkart',
   'https://www.flipkart.com/search?q=Pulse+M5&affid=veripulse', 12499, '{"battery":"2 days"}')
on conflict (id) do nothing;
