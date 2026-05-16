import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://titiljrgqynroxpaznkq.supabase.co';
const supabasePublishableKey = 'sb_publishable_oYTGDsHQOvboNc48dRfJTQ_0RqwlP7l';

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
