## Core remaining pillars

``` 
 ✅ Alerting — send email summary after every crawler run with list of newly scraped jobs
 ✅ Applied jobs secondary dashboard — separate view showing only applied jobs
 ✅ Feedback loop column in DB + dropdown on frontend (interview / rejected / ghosted / offer)


 ✅ Chrome extension autofill refinement: integrate LLM with json output (NOT DOING LLM, waste of time, only for custom questions later.)
 ❌ improve the extension with right click LLM call for long answers and try to expand the autofill with "browser-use" at https://github.com/browser-use/browser-use
 ❌ Apply bot — multi-step automation for a few actions
 ✅ Scoring logic improvements
 ✅ Expand to more job boards (Indeed, Glassdoor etc) - NO NEED, mediocre results from Greenhouse and indeed.
 ✅ Put the crawler as a celery task instead
 ✅ Never mind the crawler ended up as a cron job on github actions

 ✅ UI general polish; finalize both dashboards
 ❌ Upstash setup AND PUT CELERY ON ORACLE VM
 ✅ Clean up all the code in the repo and reorganize everything, cut out unneccessary, absorb the frontend into this repo.
 ❌ Make readme.md properly and just document all.
 
 ❌ Supabase production setup
 ❌ Azure App Service for backend
 ❌ Vercel for frontend
 ❌ Connect entire pipeline end to end in production and create some script that cleanly brings together all of the user's accnt across diff platforms basically.
 ```