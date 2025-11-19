#include<iostream>
using namespace std;

struct queue
{
	int maxsize;
	int top;
	int *items;

	queue() { };
};

void queue_initialize(queue *q, int size)
{
	q->maxsize = size;
	q->top = 0;
	q->items = new int[size];
}

void queue_push(queue *q, int item)
{
	if (q->top == q->maxsize)
		cout << "buffer overflow" << endl;
	else
	{
		q->items[q->top] = item;
		q->top++;
	}
}

void array_shift_left(int *arr, int start, int end)
{
	for (int i = start; i < end - 1; i++)
		arr[i] = arr[i + 1];
}

void queue_pop(queue *q)
{
	array_shift_left(q->items, 0, q->top);
	q->top--;
}

int queue_front(queue *q)
{
	return q->items[0];
}

int queue_back(queue *q)
{
	return q->items[q->top - 1];
}