import re, sys, time
from typing import List
import swagger_client
from swagger_client.api import AccountApi
from swagger_client.api import AliasesApi
from swagger_client.api import ChannelsApi
from swagger_client.api import MessagesApi
from swagger_client.models.currency import Currency
from swagger_client.rest import ApiException
from swagger_client.models import AccountWithdrawBody
from swagger_client.models import AliasesBody
from swagger_client.models.inline_response2007 import InlineResponse2007
from swagger_client.models.inline_response2012 import InlineResponse2012
from swagger_client.models.inline_response20012 import InlineResponse20012
from ...target_environment.anvil_env_manager import AnvilEnvironmentManager


"""
Send Messages Test Plan Implementation.
"""

TOKEN = "e2e-API-token^^"
HOST = "localhost"

class Account:
    def get_api_instance(self, node_index: int):
        """
        """
        configuration = swagger_client.Configuration()
        configuration.api_key["x-auth-token"] = TOKEN
        configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
        api_instance = AccountApi(swagger_client.ApiClient(configuration))
        return api_instance

    def get_balance(self, node_index: int, currency: Currency):
        """
        Fetch and return the balance of a certain given node index.
        """
        api_instance = self.get_api_instance(node_index)
        try:
            api_response = api_instance.account_get_balances()
            if currency == Currency.NATIVE:
                return api_response.native
            if currency is Currency.HOPR:
                return api_response.hopr
        except ApiException as e:
            print("Exception when calling AccountApi->account_get_balances: %s\n" % e)

    def withdraw(self, node_index: int, currency: Currency, amount: int, address: str) -> str:
        """
        """
        api_instance = self.get_api_instance(node_index)
        try:
            body = swagger_client.AccountWithdrawBody(currency, amount, address)
            api_response: InlineResponse2007 = api_instance.account_withdraw(body=body)
            receipt = api_response.receipt
            print("Receipt: " + receipt, sys.stdout)
            return receipt
        except ApiException as e:
            print("Exception when calling AccountApi->account_withdraw: %s\n" % e)

    def validate_native_address(self, node_index: int):
        """ """
        regex = "0x[0-9a-fA-F]{40}"
        api_instance = self.get_api_instance(node_index)
        try:
            api_response = api_instance.account_get_addresses()
            native_address = api_response.native
            assert re.match(regex, native_address)
        except ApiException as e:
            print("Exception when calling AccountApi->account_get_addresses: %s\n" % e)

    def validate_hopr_address(self, address: str):
        """ """
        pass

    def validate_balance(self, node_index: int):
        """
        Validate that node is funded.
        """
        api_instance = self.get_api_instance(node_index)
        try:
            api_response = api_instance.account_get_balances()
            balance_native = api_response.native
            balance_hopr = api_response.hopr
            assert balance_native != 0
            assert balance_hopr != 0
        except ApiException as e:
            print("Exception when calling AccountApi->account_get_balances: %s\n" % e)

    def check_withdraw(self, node_index: int, currency: Currency, previous_balance):
        """
        """
        native_balance = self.get_balance(node_index, currency)
        assert native_balance != previous_balance

class Aliases:
    def get_api_instance(self, node_index: int):
        """
        """
        configuration = swagger_client.Configuration()
        configuration.api_key["x-auth-token"] = TOKEN
        configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
        api_instance = AliasesApi(swagger_client.ApiClient(configuration))
        return api_instance

    def set_alias(self, node_index: int, peer_id: str, alias: str) -> None:
        """"""
        api_instance = self.get_api_instance(node_index)
        try:
            body = AliasesBody(peer_id, alias)
            api_instance.aliases_set_alias(body=body)
        except ApiException as e:
            print("Exception when calling AliasesApi->aliases_set_alias: %s\n" % e)

    def remove_alias(self, node_index: int, alias: int):
        """
        """
        api_instance = self.get_api_instance(node_index)
        try:
            api_instance.aliases_remove_alias(alias)
        except ApiException as e:
            print("Exception when calling AliasesApi->aliases_remove_alias: %s\n" % e)

    def check_alias(self, node_index: int, alias: str, peer_id: str) -> str:
        """
        """
        api_instance = self.get_api_instance(node_index)
        try:
            api_response: InlineResponse20012 = api_instance.aliases_get_alias(alias)
            assert peer_id == api_response.peer_id
        except ApiException as e:
            print("Exception when calling AliasesApi->aliases_get_alias: %s\n" % e)

class Channels:
    def get_api_instance(self, node_index: int):
        """
        """
        configuration = swagger_client.Configuration()
        configuration.api_key["x-auth-token"] = TOKEN
        configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
        api_instance = ChannelsApi(swagger_client.ApiClient(configuration))
        return api_instance
    
    def open_channel(self, node_index: int, peer_id: str, amount: str):
        """
        peer_id	str	PeerId that we want to transact with using this channel.
        amount	str	Amount of HOPR tokens to fund the channel. It will be used to pay for sending messages through channel	
        """
        api_instance = self.get_api_instance(node_index)
        try:
            body = swagger_client.ChannelsBody(peer_id, amount)
            api_response: InlineResponse2012 = api_instance.channels_open_channel(body=body)
            return api_response
        except ApiException as e:
            print("Exception when calling ChannelsApi->channels_open_channel: %s\n" % e)
    
    def close_channel(self, node_index: int, peer_id: str, direction: str):
        """
        direction	str	Specify which channel should be fetched, incoming or outgoing.
        """
        api_instance = self.get_api_instance(node_index)
        try:
            api_response: swagger_client.InlineResponse20011 = api_instance.channels_close_channel(peer_id, direction)
            return api_response
        except ApiException as e:
            print("Exception when calling ChannelsApi->channels_close_channel: %s\n" % e)
    
    def wait_channel_opened(self, node_index: int):
        """
        """
        pass

    def wait_channel_closed(self, node_index: int):
        """
        """
        pass

    def check_channel_opened(self, node_index: int):
        """
        """
        pass

    def check_channel_closed(self, node_index: int):
        """
        """
        pass

class Messages:
    def get_api_instance(self, node_index: int):
        """
        """
        configuration = swagger_client.Configuration()
        configuration.api_key["x-auth-token"] = TOKEN
        configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
        api_instance = MessagesApi(swagger_client.ApiClient(configuration))
        return api_instance
    
    def send_message(self, node_index: int, recipient_peer_id: str, message: str, path: List[str], hops: int):
        """
        body	str	The message body which should be sent.	
        recipient	str	The recipient HOPR peer id, to which the message is sent.	
        path	list[str]	The path is ordered list of peer ids through which the message should be sent.
        If no path is provided, a path which covers the nodes minimum required hops will be determined automatically.	[optional]
        hops	int	Number of required intermediate nodes. This parameter is ignored if path is set.	[optional]
        """
        api_instance = self.get_api_instance(node_index)
        body = swagger_client.MessagesBody(message, recipient_peer_id, )
        try:
            api_response = api_instance.messages_send_message(body=body)
            
        except ApiException as e:
            print("Exception when calling MessagesApi->messages_send_message: %s\n" % e)
    
    def check_message(self, node_index: int):
        """
        """
        pass

class Tickets:
    def get_api_instance(self, node_index: int):
        """
        """
        configuration = swagger_client.Configuration()
        configuration.api_key["x-auth-token"] = TOKEN
        configuration.host = f"http://{HOST}:1330{node_index}/api/v2"
        api_instance = MessagesApi(swagger_client.ApiClient(configuration))
        return api_instance

    def redeem_tickets(self, node_index: int):
        """
        """
        pass

def test_case1():
    """ """
    anvil_env_manager = AnvilEnvironmentManager()
    nodes = anvil_env_manager.setup_local_nodes(5)

    account = Account()
    account.validate_native_address(1)
    account.validate_native_address(2)
    account.validate_native_address(3)
    account.validate_native_address(4)
    account.validate_native_address(5)

    """

    account.validate_balance(1)
    account.validate_balance(2)
    account.validate_balance(3)
    account.validate_balance(4)
    account.validate_balance(5)

    balance_native = account.get_balance(1, Currency.NATIVE)
    balance_hopr = account.get_balance(1, Currency.HOPR)
    print("balance: " + balance_native + "," + balance_hopr, file=sys.stdout)
    account.withdraw(1, Currency.NATIVE, 10, '0x858aa354db6ae5ea1217c5018c90403bde94e09e')
    account.withdraw(1, Currency.HOPR, 10, '0x858aa354db6ae5ea1217c5018c90403bde94e09e')
    account.check_withdraw(1, Currency.NATIVE, balance_native)
    account.check_withdraw(1, Currency.HOPR, balance_hopr)

    aliases = Aliases()
    aliases.set_alias(1, nodes[1].peer_id, "Alice")
    aliases.check_alias(1, "Alice", nodes[1].peer_id)
    aliases.remove_alias(1, "Alias")

    channels = Channels()
    channels.open_channel(1, nodes[1].peer_id, "100000000000000000000")
    channels.open_channel(2, nodes[2].peer_id, "100000000000000000000")
    channels.open_channel(3, nodes[3].peer_id, "100000000000000000000")
    channels.open_channel(4, nodes[4].peer_id, "100000000000000000000")
    channels.open_channel(5, nodes[0].peer_id, "100000000000000000000")
    channels.open_channel(1, nodes[3].peer_id, "100000000000000000000")
    channels.open_channel(1, nodes[4].peer_id, "100000000000000000000")
    time.sleep(30)
    channels.close_channel(1, nodes[3].peer_id, "outgoing")

    messages = Messages()
    messages.send_message(1, nodes[1].peer_id, "Hello world", [], 1)
    messages.send_message(2, nodes[3].peer_id, "Hello world", [], 1)
    messages.send_message(3, nodes[4].peer_id, "Hello world", [], 1)
    """