# Open questions

Version C does not answer these. The demo stores operator settings and refuses to invent a statutory number. Demo rates (Rs 15 per km running cost, Rs 8 per km cap) exist only so the static demo can be clicked. They are labelled `demo`.

## Legal

1. Does a private car, carrying passengers who reimburse a capped share of cost, need a public service vehicle licence, taxi licence, or contract-car licence under the Road Traffic Act and the National Land Transport Authority Act 2019?
2. Is there a statutory or ministerial cap, per kilometre or otherwise? None is hardcoded as law. Clearing the settings blocks new requests.
3. May the running cost include insurance, tyres, and depreciation, or only fuel? The app has one rupees-per-kilometre field.
4. May Bojo Solutions charge a platform fee without being treated as a transport operator? The fee defaults to 0. A non-zero fee is flagged and is not paid to the driver.
5. Who is liable in a crash? The form stores an insurance expiry the driver typed. It does not check that the policy covers paying passengers.
6. Is admin review of a typed NIC, licence number, and insurance date enough, or is a formal identity check required?
7. Is Bojo Solutions registered with the Data Protection Office under the Data Protection Act 2017? This demo claims no registration and no data-protection officer.
8. How long may NIC numbers, licence numbers, and trip history be kept?
9. Are pickup points precise enough to be sensitive location data?
10. Does the offline cost-share record create a tax or VAT obligation?
11. Rodrigues has its own transport committee under the NLTA Act. The demo does not treat Rodrigues separately.
12. The product languages are English and French. Whether consumer text must also be in Kreol Morisien is open.
13. The demo charges no cancellation fee, because a fee can look like a fare. Whether a no-show should have a consequence is open.

## Product choices that are configuration, not law

- Running cost per km, cap per km, platform fee, whether the driver’s seat counts, and whether the split uses seats offered (default) or seats already confirmed.
- Match text threshold 0.5, match radius 8 km, minimum lead time 30 minutes, search horizon 14 days, maximum typed distance 150 km.
- One role per account.
- Visitors can browse. Requesting a seat needs a verified passenger. Phone numbers stay hidden until acceptance.
- An accepted amount is not raised later. If an admin lowers the cap before acceptance, the locked amount uses the lower figure.

## API keys

The Pages build uses none. Names live in `.env.example`.

| Name | Used by the static demo? | Purpose if a later server build needs it |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional. Empty on Pages. Distance still comes from the gazetteer. | Maps JavaScript API in the browser. Restrict by HTTP referrer. |
| `GOOGLE_MAPS_API_KEY` | No | Distance Matrix on a server. Do not put this in a static bundle. |
| `SMS_PROVIDER_API_KEY` | No. OTP is a mock code shown on the page. | A real SMS vendor. |
| `EMAIL_PROVIDER_API_KEY` | No. Messages stay in the on-page inbox. | Transactional email. |
| `PAYMENT_PROVIDER_API_KEY` | No. Settlement is an offline acknowledgement and records `moneyMoved: false`. | Only if counsel allows a collection method. Version C is not a card fare. |

No NLTA, police, Maupass, or bank credentials are included or invented.
