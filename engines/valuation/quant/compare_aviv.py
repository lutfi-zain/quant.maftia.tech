import requests
import json
import re
import statistics
import math
from datetime import datetime, timedelta

def get_checkonchain_data():
    url = "https://charts.checkonchain.com/btconchain/unrealised/mvrv_aviv_zscore/mvrv_aviv_zscore_light.html"
    print(f"Fetching Checkonchain HTML from {url}...")
    resp = requests.get(url)
    resp.raise_for_status()
    html = resp.text
    
    parts = html.split('Plotly.newPlot(')
    if len(parts) < 2:
        raise ValueError("Could not find Plotly.newPlot in HTML")
        
    p = parts[1]
    # find the first [
    start = p.find('[')
    # find the ] that balances the [
    depth = 0
    end = -1
    for i in range(start, len(p)):
        if p[i] == '[':
            depth += 1
        elif p[i] == ']':
            depth -= 1
            if depth == 0:
                end = i
                break
                
    data_json = p[start:end+1]
    try:
        traces = json.loads(data_json)
    except Exception as e:
        # Sometimes there's trailing commas or bad json formatting in JS
        # A simple fix for trailing commas before ] or }
        data_json = re.sub(r',\s*([\]}])', r'\1', data_json)
        traces = json.loads(data_json)
        
    for trace in traces:
        if trace.get("name") == "AVIV Z-Score":
            import base64
            import struct
            
            dates = trace.get("x", [])
            y_data = trace.get("y", [])
            print(f"DEBUG trace keys: {list(trace.keys())}")
            if "y" in trace:
                print(f"DEBUG trace['y'] type: {type(trace['y'])}")
                if isinstance(trace['y'], dict):
                    print(f"DEBUG trace['y'] keys: {list(trace['y'].keys())}")
                else:
                    print(f"DEBUG trace['y'] start: {str(trace['y'])[:100]}")
            
            values = []
            if isinstance(y_data, dict) and "bdata" in y_data:
                dtype = y_data.get("dtype")
                bdata = y_data.get("bdata")
                print(f"DEBUG dtype: {dtype}")
                decoded = base64.b64decode(bdata)
                # float64
                if dtype in ["float64", "f8", "<f8", ">f8"]:
                    values = struct.unpack(f"{len(decoded)//8}d", decoded)
                elif dtype in ["float32", "f4", "<f4", ">f4"]:
                    values = struct.unpack(f"{len(decoded)//4}f", decoded)
                else:
                    print(f"DEBUG unsupported dtype: {dtype}")
            else:
                values = y_data
                
            result = {}
            for d, v in zip(dates, values):
                if v is not None:
                    try:
                        val = float(v)
                        dt_str = str(d).split('T')[0]
                        result[dt_str] = val
                    except (ValueError, TypeError):
                        pass
            print(f"DEBUG: first 5 checkonchain points: {list(result.items())[:5]}")
            return result
            
    raise ValueError("Could not find 'AVIV Z-Score' trace in Checkonchain data")

def get_bitview_unclamped_data():
    url = "https://bitview.space/api/series/aviv_ratio/day1/data"
    print(f"Fetching raw AVIV from {url}...")
    resp = requests.get(url)
    resp.raise_for_status()
    raw_data = resp.json()
    
    start_date = datetime(2009, 1, 3)
    
    valid_data = []
    for i, row in enumerate(raw_data):
        if row is not None:
            valid_data.append({
                "date": (start_date + timedelta(days=i)).strftime("%Y-%m-%d"),
                "value": float(row)
            })
            
    # Compute unclamped Z-Score
    raw_values = [d["value"] for d in valid_data]
    mean = statistics.mean(raw_values)
    std = statistics.stdev(raw_values)
    
    result = {}
    for d in valid_data:
        z = (d["value"] - mean) / std
        result[d["date"]] = z
        
    return result

def main():
    print("Starting comparison...")
    coc_data = get_checkonchain_data()
    print(f"Checkonchain data points: {len(coc_data)}")
    
    our_data = get_bitview_unclamped_data()
    print(f"Our unclamped data points: {len(our_data)}")
    
    # Let's calculate an expanding Z-score starting from 2013-01-02
    expanding_our = {}
    history = []
    
    # Need original raw data mapping
    url = "https://bitview.space/api/series/aviv_ratio/day1/data"
    resp = requests.get(url)
    raw_data = resp.json()
    start_date = datetime(2009, 1, 3)
    raw_dict = {}
    for i, row in enumerate(raw_data):
        if row is not None:
            raw_dict[(start_date + timedelta(days=i)).strftime("%Y-%m-%d")] = float(row)
            
    for d in sorted(raw_dict.keys()):
        if d >= "2013-01-02":
            history.append(raw_dict[d])
            if len(history) > 1:
                mean = statistics.mean(history)
                std = statistics.stdev(history)
                z = (raw_dict[d] - mean) / std if std > 0 else 0
                expanding_our[d] = z
            else:
                expanding_our[d] = float('nan')
                
    print("\nDEBUG: Expanding Z-Score vs Checkonchain:")
    for d in sorted(expanding_our.keys())[:5]:
        print(f"{d} | COC: {coc_data.get(d)} | Expanding Ours: {expanding_our[d]}")
        
    common_dates = sorted(list(set(coc_data.keys()).intersection(set(expanding_our.keys()))))
    print(f"Common dates: {len(common_dates)}")
    if not common_dates:
        print("No common dates found!")
        return
        
    differences = []
    coc_values = []
    our_values = []
    
    for d in common_dates:
        coc_val = coc_data[d]
        our_val = our_data[d]
        if math.isnan(coc_val) or math.isnan(our_val):
            continue
            
        diff = abs(coc_val - our_val)
        
        differences.append(diff)
        coc_values.append(coc_val)
        our_values.append(our_val)
        
    if not differences:
        print("No valid numeric data found for comparison!")
        return
        
    mean_abs_error = statistics.mean(differences)
    max_error = max(differences)
    
    # Pearson Correlation
    mean_coc = statistics.mean(coc_values)
    mean_our = statistics.mean(our_values)
    num = sum((c - mean_coc) * (o - mean_our) for c, o in zip(coc_values, our_values))
    den_coc = sum((c - mean_coc)**2 for c in coc_values)
    den_our = sum((o - mean_our)**2 for o in our_values)
    correlation = num / ((den_coc * den_our)**0.5) if (den_coc * den_our) > 0 else 0
    
    print("\n--- STATISTICAL ANALYSIS RESULTS ---")
    print(f"Mean Absolute Error (MAE): {mean_abs_error:.6f}")
    print(f"Max Absolute Error: {max_error:.6f}")
    print(f"Pearson Correlation: {correlation:.6f}")
    
    print("\nSample Data Comparison (Last 5 days):")
    for d in common_dates[-5:]:
        print(f"{d} | Checkonchain: {coc_data[d]:.4f} | Ours (Unclamped): {our_data[d]:.4f} | Diff: {abs(coc_data[d] - our_data[d]):.4f}")

if __name__ == "__main__":
    main()
