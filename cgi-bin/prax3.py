#!/usr/bin/python3
# -*- coding: UTF-8 -*-
"""Python script for prax3."""
import cgitb
import json
import os
import sys
import time
from typing import Dict, List


cgitb.enable()
RESULTS_PATH = 'cgi-bin/results.json'


print('Content-type: application/json')
print()


def read_file() -> Dict[str, List[Dict[str, str or int]]]:
    """
    Read the data from file and return it.

    :return: Python dict object with data.
    """
    with open(RESULTS_PATH, 'r+') as results:
        return json.load(results)


def save_game_data():
    """
    Save the data obtained from the frontend to the JSON file.

    :return: None
    """
    content_length = int(os.environ['CONTENT_LENGTH'])
    data = sys.stdin.read(content_length)
    json_data = json.loads(data)
    normalize_time(json_data, time_to_int)

    with open(RESULTS_PATH, 'a+') as results_read:  # Read all present scores and add a new score.
        results_read.seek(0)
        scores = json.load(results_read)
        scores['scores'].append(json_data)

    with open(RESULTS_PATH, 'w') as results_write:  # Write JSON with new score.
        json.dump(scores, results_write, indent=4)


def load_game_data():
    """
    POST the data from the JSON file to the frontend.

    :return: None
    """
    data = read_file()
    normalize_time(data, time_to_str)
    print(json.JSONEncoder().encode(data))


def normalize_time(data: dict, function):
    """
    Apply time normalization functions onto the time in data dict.

    :param data: Data dictionary.
    :param function: Function to apply.
    :return: None
    """
    if 'scores' in data and data['scores']:
        for x in data['scores']:
            x['time'] = function(x['time'])
    else:
        data['time'] = function(data['time'])


def time_to_str(t: int) -> str:
    """
    Convert time in seconds into string with format 'hh:mm:ss'.

    :param t: Time in seconds.
    :return: Time string.
    """
    return time.strftime('%H:%M:%S', time.gmtime(t))


def time_to_int(t: str) -> int:
    """
    Convert time string to integer value, representing this time in minutes.

    String is following the format "hh:mm:ss"

    :param t: Time string to convert.
    :return: Time in seconds.
    """
    h, m, s = t.split(':')
    return int(h) * 3600 + int(m) * 60 + int(s)


def sort_data(value: str, order: bool, name: str = ''):
    """
    Sort the data by some value and POST it to the frontend.

    :param value: Criteria by which the sorting should be done,
    :param order: True means ascending and False descending order.
    :param name: Player name to count while sorting.
    :return: None
    """
    data_from_file = read_file()
    data_from_file['scores'].sort(key=lambda x: x[value], reverse=order)
    if name:
        filter_data_by_player(name, data_from_file)
        return
    normalize_time(data_from_file, time_to_str)
    print(json.JSONEncoder().encode(data_from_file))


def filter_data_by_player(name: str, data: dict = {}):
    """
    Filter the data by the player name and POST it to the frontend.

    :param name: Name of the player to use while filtering.
    :param data: Optional data to consider while filtering.
    :return: None
    """
    if data:
        to_filter = data
    else:
        to_filter = read_file()
    normalize_time(to_filter, time_to_str)
    if name:
        to_filter['scores'] = list(filter(lambda x: name in x['name'], to_filter['scores']))
    print(json.JSONEncoder().encode(to_filter))


query_string = os.environ['QUERY_STRING']
query_params = {} if not query_string else {elem.split('=')[0]: elem.split('=')[1] for elem in query_string.split('&')}

request_method = os.environ['REQUEST_METHOD']
if request_method == 'GET':
    if query_params:
        action = query_params['action']
        if 'name' in query_params:
            player_name = query_params['name']
        else:
            player_name = ''

        if action == 'sort':
            criteria = query_params['criteria']

            sort_data(criteria, query_params['order'] == 'asc', player_name)

        elif action == 'filter':
            filter_data_by_player(player_name)

    else:
        load_game_data()
elif request_method == 'POST':
    save_game_data()
