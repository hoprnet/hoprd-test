import re, sys, time
import swagger_client
from swagger_client.api import AccountApi
from swagger_client.rest import ApiException
from swagger_client.models import AccountWithdrawBody
from swagger_client.models.currency import Currency
from ...target_environment.anvil_env_manager import AnvilEnvironmentManager


"""
Send Messages Test Plan Implementation.
"""

TOKEN = "e2e-API-token^^"
HOST = "localhost"

def get_balance(node_index: int, currency: Currency):
    """
    Fetch and return the balance of a certain given node index.
    """
    configuration = swagger_client.Configuration()
    configuration.api_key["x-auth-token"] = TOKEN
    configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
    api_instance = swagger_client.AccountApi(swagger_client.ApiClient(configuration))
    try:
        api_response = api_instance.account_get_balances()
        if currency == Currency.NATIVE:
            return api_response.native
        if currency is Currency.HOPR:
            return api_response.hopr
    except ApiException as e:
        print("Exception when calling AccountApi->account_get_addresses: %s\n" % e)

def withdraw(currency: Currency, node_index: int, amount: int, address: str):
    """
    """
    configuration = swagger_client.Configuration()
    configuration.api_key["x-auth-token"] = TOKEN
    configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
    api_instance = swagger_client.AccountApi(swagger_client.ApiClient(configuration))
    try:
        body = swagger_client.AccountWithdrawBody(currency, amount, address)

        api_response = api_instance.account_withdraw(body=body)
        balance_native = api_response.native
        balance_hopr = api_response.hopr
        assert balance_native != 0
        assert balance_hopr != 0
    except ApiException as e:
        print("Exception when calling AccountApi->account_get_addresses: %s\n" % e)

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
        assert balance_native != 0
        assert balance_hopr != 0
    except ApiException as e:
        print("Exception when calling AccountApi->account_get_addresses: %s\n" % e)

def check_withdraw(node_index: int, currency: Currency, previous_balance):
    """
    """
    native_balance = get_balance(currency)


def check_hopr_withdraw():
    """
    """

def test_case1():
    """ """
    anvil_env_manager = AnvilEnvironmentManager()
    anvil_env_manager.setup_local_nodes(1)
    validate_native_address(1)
    # validate_native_address(2)
    # validate_native_address(3)
    # validate_native_address(4)
    # validate_native_address(5)

    validate_balance(1)
    # validate_balance(2)
    # validate_balance(3)
    # validate_balance(4)
    # validate_balance(5)

    #current_balance_native = get_balance(1, Currency.NATIVE)
    #current_balance_hopr = get_balance(1, Currency.HOPR)
    #print("balance: " + current_balance_native + "," + current_balance_hopr, file=sys.stdout)

    #withdraw(Currency.NATIVE, 10, '0x858aa354db6ae5ea1217c5018c90403bde94e09e')
    #withdraw(Currency.HOPR, 10, '0x858aa354db6ae5ea1217c5018c90403bde94e09e')

    #check_native_withdraw()
    #check_hopr_withdraw()