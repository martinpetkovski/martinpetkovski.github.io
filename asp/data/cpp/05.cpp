#include<iostream>
using namespace std;

void selection_sort(int niza[], int n)
{
	for (int i = 0; i < n; i++) {
		int min = i;
		for (int j = i + 1; j < n; j++)
			if (niza[j] < niza[min])
				min = j;
		if (min != i)
			swap(niza[min], niza[i]);
	}
}