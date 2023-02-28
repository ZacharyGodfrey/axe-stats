# axe-charts

Axe Charts is a simple site for visualizing IATF axe throwing data

![Netlify Status](https://api.netlify.com/api/v1/badges/88cf6fc1-85ed-4648-82f4-8a630b35f6c0/deploy-status)

---

## Roadmap

- Add GitHub Action on a weekly cron schedule
  - Use Puppeteer to hit AxeScores and intercept API responses
  - Store captured data in a SQLite database file
  - Commit database file back to the repo ([example](https://github.com/ZacharyGodfrey/mono/blob/main/.github/workflows/ci-workflow.yml))
- Update database object to connect to the database file
  - Add methods for reading and writing data
- Update build script to iterate database records to generate player profile pages

---

## References

https://docs.netlify.com/configure-builds/file-based-configuration

https://docs.netlify.com/site-deploys/overview/#deploy-contexts

https://github.com/AaronBeaudoin/vite-plugin-ssr-example-netlify

https://github.com/vuejs/petite-vue

https://pptr.dev

https://techoverflow.net/2019/08/15/minimal-puppeteer-response-interception-example

https://www.sqlitetutorial.net/sqlite-select
