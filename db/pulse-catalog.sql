-- Keep Pulse's stable catalog key and surface its native portal report.
BEGIN;
UPDATE axxes_product SET
 url='https://pulse.axxes.app',
 tagline='Clear analytics for every app you build.',
 description='Website traffic, conversions, performance, and AXXES business outcomes in one intuitive workspace.',
 color='#5b8cff',members_path='/pulse',surface_in_members=true,updated_at=now()
WHERE key='pulse';
COMMIT;
