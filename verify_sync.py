import requests
import json

def test_sim(rid):
    url = f"http://localhost:8010/api/simulate?rocket_id={rid}"
    try:
        r = requests.get(url)
        data = r.json()
        print(f"Rocket ID: {rid} -> Name: {data.get('rocket_name')}, Score: {data.get('score')}")
    except Exception as e:
        print(f"Error test {rid}: {e}")

print("--- VERIFYING DYNAMIC RESULTS ---")
test_sim("ares")
test_sim("shuttle")
test_sim("falcon-9")
print("------------------------------")
