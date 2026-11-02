import {mkdir,copyFile,cp,readFile,writeFile} from 'node:fs/promises';
await mkdir('dist/katex',{recursive:true});
for(const file of ['index.html','app.js','theme.js','language.js','style.css','favicon.svg'])await copyFile('local-review/public/'+file,'dist/'+file);
await copyFile('node_modules/katex/dist/katex.min.css','dist/katex/katex.min.css');await cp('node_modules/katex/dist/fonts','dist/katex/fonts',{recursive:true});
let html=await readFile('dist/index.html','utf8');html=html.replace('PHASE 4','HOSTED REVIEW').replace('Local review · papers, accounts, and lessons save on this computer','Mathroom · your personal learning workspace');await writeFile('dist/index.html',html);
let app=await readFile('dist/app.js','utf8');app=app.replaceAll('Phase 4 review','Hosted review').replaceAll('Lessons and notes saved on this computer.','Private lessons, work and feedback.').replace('Accounts, chapters, and lessons save on this computer. Hosting and access from other devices are configured before the real-use trial.','Your account, chapters and work are stored in the hosted workspace.').replaceAll('Unable to reach the local server.','Unable to reach the server.').replace('Start the local server, then reload this page.','Check your connection, then reload this page.');await writeFile('dist/app.js',app);
app=app.replace("input('Username','username','text','','required minlength=\"3\" maxlength=\"32\" autocomplete=\"username\"", "input('Email or username','username','text','','required maxlength=\"254\" autocomplete=\"username\"")
 .replace('Your tutor provides your username and password. Ask your tutor if you need a reset.','Tutor: sign in with your Supabase email and password. Students: use the login provided by your tutor.');
await writeFile('dist/app.js',app);
