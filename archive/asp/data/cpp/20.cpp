#include<iostream>
using namespace std;

struct stack
{
	int maxsize;
	int top;
	int *items;

	stack() {};
};

void stack_initialize(stack *stk, int size)
{
	stk->top = 0;
	stk->items = new int[size];
	stk->maxsize = size;
}

void stack_push(stack *stk, int item)
{
	if (stk->top == stk->maxsize)
		cout << "buffer overflow" << endl;
	else
	{
		stk->items[stk->top] = item;
		stk->top++;
	}
}

int stack_pop(stack *stk)
{
	if (stk->top == 0)
		cout << "buffer underflow" << endl;
	else
	{
		stk->top--;
		return stk->items[stk->top];
	}
}

int stack_top(stack *stk)
{
	return stk->items[stk->top - 1];
}