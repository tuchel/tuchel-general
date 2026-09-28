"""Download the public PVGIS inputs used in the Reitweg feasibility study."""
import concurrent.futures
import json
from pathlib import Path
import urllib.parse
import urllib.request

DESTINATION = Path('tmp/solar')
DESTINATION.mkdir(parents=True, exist_ok=True)
FACES = {'main-east': (35.4, -82.5), 'main-west': (35.4, 97.5),
         'guest-east': (36.1, -77.2), 'guest-west': (36.1, 102.8)}
JOBS = [(name, angle, aspect, 'seriescalc') for name, (angle, aspect) in FACES.items()]
JOBS += [(f'sensitivity-{face}-{angle}', angle, aspect, 'PVcalc')
         for face, aspect in [('east', -82.5), ('west', 97.5)] for angle in [30, 40]]


def fetch(job):
    name, angle, aspect, endpoint = job
    params = dict(lat=47.8606705, lon=11.2919095, peakpower=1, loss=14,
                  angle=angle, aspect=aspect, raddatabase='PVGIS-SARAH3',
                  pvtechchoice='crystSi', mountingplace='free', usehorizon=1,
                  outputformat='json')
    if endpoint == 'seriescalc':
        params.update(startyear=2005, endyear=2023, pvcalculation=1)
    url = 'https://re.jrc.ec.europa.eu/api/v5_3/' + endpoint + '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=180) as response:
        data = response.read()
    result = json.loads(data)
    assert 'outputs' in result, f'Invalid PVGIS response: {name}'
    if endpoint == 'seriescalc':
        assert len(result['outputs']['hourly']) == 166536, f'Incomplete hourly series: {name}'
    (DESTINATION / (name + '.json')).write_bytes(data)
    print(name, 'saved', flush=True)


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(fetch, JOBS))
