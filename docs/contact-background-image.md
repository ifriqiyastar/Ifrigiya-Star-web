# Contact section background

Generated with the built-in `image_gen` tool. Delivery asset:
`public/images/contact-football-tunisia.webp`.

## Final generation prompt

Use case: photorealistic-natural. Asset type: wide photographic background for the Contactez-nous section of Ifriqiya Star, a Tunisian football academy website with black, white and lime green (#aff70f) branding. Primary request: a cinematic authentic Tunisian football training ground at dusk, two young adult North African football players and their coach in conversation near the touchline on the right third, wearing unbranded black sportswear with small lime training details. Scene: richly textured green grass, subtle white pitch markings, distant floodlights and softly silhouetted Mediterranean palms, believable modest academy ground. Composition: panoramic 3:1 landscape, human subjects on right, left two thirds calm dark negative space for website text overlay. Lighting: atmospheric dusk, soft floodlight rim lighting, deep black shadows, restrained natural green. Style: premium editorial sports photography, realistic anatomy and grass, subtle film grain, no artificial glow. Constraints: no text, no logos, no watermark, no UI, no lettering on clothes.

## Contact form delivery

The `/contact` form validates the required name, email, topic, and message,
then sends it server-side via Resend (`lib/actions/contact.ts`). The public
contact address shown on the page, `ifriqiya.star@gmail.com`, is also where
these submissions land — see that file for why (the domain
`ifriqiya-soccer.com` is verified with Resend for sending but has no mailbox
of its own yet). No message is stored on the server; a failed send shows an
inline error instead of a delivery confirmation.
