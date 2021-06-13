import asyncio
import wrapt
from icecream import ic


class Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(
                *args, **kwargs
            )
        return cls._instances[cls]


class FSMMeta(type):
    def __init__(self, name, bases, namespace, **kwargs):
        super().__init__(name, bases, namespace, **kwargs)
        ic(locals())


class FSM(metaclass=FSMMeta):
    pass


class StateMeta(type):
    def __init__(self, name, bases, namespace, **kwargs):
        super().__init__(name, bases, namespace, **kwargs)
        ic(locals())


def my_dec_dec(func, caller, extras=(), kwsyntax=False):
    print("my_decdec")
    return func


my_metadec = decorate(decorator, my_dec_dec)

# def log_decoration():
#     return


class State(metaclass=StateMeta):

    on_enter_callbacks = list()
    # FunctionWrapper


class StatesBaseMeta(type):
    def __init__(self, name, bases, namespace, **kwargs):
        super().__init__(name, bases, namespace, **kwargs)
        ic(locals())


class StatesBase(metaclass=StatesBaseMeta):
    class ANY(State):
        pass


class CurrentStateDescriptor:
    def __get__(self, obj, objtype=None):
        return obj._current_state

    def __set__(self, obj, val):
        print(f"Changing state to {val}")
        obj._crt_state = val


class MyMachine(FSM):
    class States(StatesBase):
        class Red(State):
            pass

        class Yellow(State):
            pass

        class Green(State):
            pass

    initial_state = States.Green
    current_state = CurrentStateDescriptor()

    def __init__(self):
        self.current_state = self.initial_state

        # print(self.red_green.fun_stuff)

    # @States.on_enter(States.Red, execute_on_initial=False)
    @States.Green.on_enter
    async def green_yellow(self):
        await asyncio.sleep(2)
        self.current_state = self.States.Yellow

    @States.Yellow.on_enter
    async def yellow_red(self):
        await asyncio.sleep(1)
        self.current_state = self.States.Red

    @States.Red.on_enter
    async def red_green(self, data=None):
        await asyncio.sleep(2)
        self.current_state = self.States.Green



async def main():
    machine = MyMachine()
    print("hi!")
    await machine.red_green(data="12")
    await asyncio.sleep(1)
    asyncio.get_event_loop().stop()


if __name__ == "__main__":
    asyncio.run(main())
