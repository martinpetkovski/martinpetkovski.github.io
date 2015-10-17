#include<iostream>
using namespace std;

void insertion_sort(int niza[], int n)
{
	for (int i = 1; i < n; i++) {
		int element = niza[i];
		int j = i;
		while (j > 0 && niza[j - 1] > element) {
			niza[j] = niza[j - 1];
			j--;
		}
		niza[j] = element;
	}
}