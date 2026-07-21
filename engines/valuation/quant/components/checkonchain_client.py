import requests
import json
import re
import base64
import struct
import logging
import pandas as pd

logger = logging.getLogger(__name__)

class CheckonchainClientError(Exception):
    """Custom exception for checkonchain.com scraper errors."""
    pass

def fetch_plotly_chart(url: str) -> dict[str, pd.DataFrame]:
    """
    Fetches the HTML of a plotly chart from checkonchain.com,
    parses the JSON traces within the Plotly.newPlot block,
    decodes base64-encoded binary y data (bdata) if present,
    and returns a dictionary mapping trace names to pandas DataFrames.
    Each DataFrame has columns ['date', 'value'].
    """
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    try:
        logger.info(f"Fetching Plotly chart from {url}...")
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise CheckonchainClientError(f"HTTP request failed: {str(e)}")

    html = resp.text

    # Check for iframe redirection (common in newer checkonchain pages)
    iframe_match = re.search(r'<iframe[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if iframe_match:
        iframe_url = iframe_match.group(1)
        try:
            logger.info(f"Detected iframe wrapper. Fetching actual chart HTML from {iframe_url}...")
            resp = requests.get(iframe_url, headers=headers, timeout=30)
            resp.raise_for_status()
            html = resp.text
        except requests.RequestException as e:
            raise CheckonchainClientError(f"HTTP request for iframe failed: {str(e)}")

    parts = html.split('Plotly.newPlot(')
    if len(parts) < 2:
        raise CheckonchainClientError(f"Could not find Plotly.newPlot block in HTML from {url}")

    p = parts[1]
    start = p.find('[')
    if start == -1:
        raise CheckonchainClientError(f"Could not find JSON array start bracket in Plotly.newPlot call from {url}")

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

    if end == -1:
        raise CheckonchainClientError(f"Could not find JSON array end bracket in Plotly.newPlot call from {url}")

    data_json = p[start:end+1]
    try:
        traces = json.loads(data_json)
    except Exception:
        # Retry cleaning up trailing commas (common in hand-edited js files)
        data_json = re.sub(r',\s*([\]}])', r'\1', data_json)
        try:
            traces = json.loads(data_json)
        except Exception as e:
            raise CheckonchainClientError(f"Failed to parse JSON from Plotly.newPlot: {str(e)}")

    result = {}
    for idx, trace in enumerate(traces):
        name = trace.get("name")
        if not name:
            name = f"trace_{idx}"
            
        x_data = trace.get("x", [])
        y_data = trace.get("y", [])
        
        values = []
        if isinstance(y_data, dict) and "bdata" in y_data:
            dtype = y_data.get("dtype", "f8")
            bdata = y_data.get("bdata", "")
            try:
                decoded = base64.b64decode(bdata)
                if dtype in ["float64", "f8", "<f8", ">f8"]:
                    values = list(struct.unpack(f"{len(decoded)//8}d", decoded))
                elif dtype in ["float32", "f4", "<f4", ">f4"]:
                    values = list(struct.unpack(f"{len(decoded)//4}f", decoded))
                else:
                    raise CheckonchainClientError(f"Unsupported binary dtype: {dtype}")
            except Exception as e:
                raise CheckonchainClientError(f"Failed to decode binary plotly array for trace {name}: {str(e)}")
        else:
            values = y_data

        # Align x (dates) and y (values) into a dataframe
        if len(x_data) != len(values):
            logger.warning(f"Length mismatch for trace '{name}' in {url}: x={len(x_data)}, y={len(values)}")
            min_len = min(len(x_data), len(values))
            x_data = x_data[:min_len]
            values = values[:min_len]
            
        # Format dates as ISO8601 YYYY-MM-DDT00:00:00Z
        dates_formatted = [str(d).split('T')[0] + "T00:00:00Z" for d in x_data]
        
        df = pd.DataFrame({
            "date": dates_formatted,
            "value": values
        })
        # Convert numeric values, drop non-finite/null
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
        df = df.dropna(subset=["value"]).reset_index(drop=True)
        
        result[name] = df

    return result
