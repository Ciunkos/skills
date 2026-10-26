# Why the name

Bing and other participating engines offer IndexNow: a protocol for notifying search engines about added, changed, or removed URLs. This skill supplies the persistent GSC workflow the name suggests. It does not claim that Google implements the protocol or that requests force indexing.

## Actual IndexNow

The protocol verifies site control using a hosted key file. It supports individual notifications and JSON batches of up to 10,000 URLs. Participating engines share notifications. A successful response acknowledges receipt, not guaranteed indexing.

Example protocol payload, for reference only:

```json
{
  "host": "www.example.com",
  "key": "replace-with-your-hosted-key",
  "urlList": ["https://www.example.com/pricing"]
}
```

This skill does not generate keys, deploy files, or send Bing notifications. A user who wants that integration can follow the official documentation separately.

- [IndexNow documentation](https://www.indexnow.org/documentation)
- [Bing's IndexNow overview](https://www.bing.com/indexnow)

## Google's interfaces

Google can discover and index content without manual submission. Search Console's URL Inspection interface lets an owner or full user request crawling of individual URLs. Google documents a quota but does not promise a fixed daily allowance. Repeated requests do not accelerate crawling; acceptance does not guarantee indexing. The skill learns available capacity by actually attempting eligible requests until GSC refuses further submissions.

The URL Inspection API returns indexed-version information. It is not a general submission API. Google's separate Indexing API is restricted to eligible job posting and livestream pages. Do not route ordinary website pages through it or reverse-engineer private GSC endpoints.

- [Request recrawling and sitemap discovery](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [URL Inspection browser tool](https://support.google.com/webmasters/answer/9012289)
- [URL Inspection API](https://developers.google.com/webmaster-tools/v1/urlInspection.index/inspect)
- [Indexing API eligibility](https://developers.google.com/search/apis/indexing-api/v3/using-api)
- [Localized versions and hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions)

Reviewed October 23, 2026. Recheck official guidance if interfaces or eligibility change.
