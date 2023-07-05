import re
import time
import swagger_client
from swagger_client.api import AccountApi
from swagger_client.rest import ApiException
from ...target_environment.anvil_env_manager import AnvilEnvironmentManager


"""
Send Messages Test Plan Implementation.
"""

TOKEN = "e2e-API-token^^"
HOST = "localhost"

def validate_native_address(node_index: int):
    """ """
    regex = "0x[0-9a-fA-F]{40}"
    configuration = swagger_client.Configuration()
    configuration.api_key["x-auth-token"] = TOKEN
    configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
    api_instance = swagger_client.AccountApi(swagger_client.ApiClient(configuration))
    try:
        api_response = api_instance.account_get_addresses()
        native_address = api_response.native
        assert re.match(regex, native_address)
    except ApiException as e:
        print("Exception when calling AccountApi->account_get_addresses: %s\n" % e)


def validate_hopr_address(address: str):
    """ """
    pass


def validate_balance(node_index: int):
    """
    Validate that node is funded.
    """
    configuration = swagger_client.Configuration()
    configuration.api_key["x-auth-token"] = TOKEN
    configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
    api_instance = swagger_client.AccountApi(swagger_client.ApiClient(configuration))
    try:
        api_response = api_instance.account_get_balances()
        balance_native = api_response.native
        balance_hopr = api_response.hopr
        f = open("log.txt", "w")
        f.write("native: " + balance_native + " hopr: " + balance_hopr + "\n")
        f.write(str(api_response))
        f.flush()
        f.close()
        assert balance_native != 0
        assert balance_hopr != 0
    except ApiException as e:
        print("Exception when calling AccountApi->account_get_addresses: %s\n" % e)


def test_case1():
    """ """
    anvil_env_manager = AnvilEnvironmentManager()
    anvil_env_manager.setup_local_nodes(1)
    logging.critical("looooggg")
    #validate_native_address(1)
    # validate_native_address(2)
    # validate_native_address(3)
    # validate_native_address(4)
    # validate_native_address(5)

    #validate_balance(1)
    # validate_balance(2)
    # validate_balance(3)
    # validate_balance(4)
    # validate_balance(5)
