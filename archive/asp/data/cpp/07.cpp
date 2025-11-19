#include<iostream>
using namespace std;

void bubble_sort(int niza[], int n)
{
	for (int i = 0; i < (n - 1); i++)
		for (int j = 0; j < n - i - 1; j++)
			if (niza[j] > niza[j + 1])
				swap(niza[j], niza[j + 1]);
}